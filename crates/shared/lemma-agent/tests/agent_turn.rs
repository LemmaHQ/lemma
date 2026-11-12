//! Turns assembled by an agent over migrated domains and a scripted model.

use std::error::Error;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::{env, fs};

use futures::stream;
use lemma_agent::{Agent, TurnEvent, TurnRequest};
use lemma_auth::AuthService;
use lemma_core::{StopReason, StreamEvent, ToolCall};
use lemma_model::{
    Adapter, ApiFormat, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest,
};
use lemma_provider::{CreateCustomInput, ProviderModel, ProviderService};
use lemma_session::SessionService;
use lemma_test_db::on_each_database;
use sea_orm_migration::sea_orm::DatabaseConnection;
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use serde_json::json;
use uuid::Uuid;

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all: Vec<_> = [
            lemma_auth::migrations(),
            lemma_provider::migrations(),
            lemma_session::migrations(),
        ]
        .into_iter()
        .flatten()
        .collect();
        all.sort_by(|a, b| a.name().cmp(b.name()));
        all
    }
}

/// Tool names offered by each model request.
type OfferedTools = Arc<Mutex<Vec<Vec<String>>>>;

/// Records the tools each request offers, then asks for a tool.
struct RecordingAdapter(OfferedTools);

impl Adapter for RecordingAdapter {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let names = req.tools.into_iter().map(|tool| tool.name).collect();
        self.0.lock().unwrap_or_else(|e| e.into_inner()).push(names);
        Ok(Box::pin(stream::iter([
            Ok(StreamEvent::ToolCallEnd {
                call: ToolCall {
                    id: "call-1".into(),
                    name: "bash".into(),
                    arguments: json!({ "command": "ls" }),
                    started_at: None,
                    finished_at: None,
                },
            }),
            Ok(StreamEvent::Done {
                stop_reason: StopReason::ToolUse,
                usage: None,
            }),
        ])))
    }
}

struct RecordingConnector(OfferedTools);

impl Connector for RecordingConnector {
    type Adapter = RecordingAdapter;

    fn connect(&self, _endpoint: Endpoint) -> RecordingAdapter {
        RecordingAdapter(Arc::clone(&self.0))
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(vec![])
    }
}

/// What one prepared and finished turn left behind.
struct Outcome {
    offered: Vec<Vec<String>>,
    tool_started: bool,
    roles: Vec<String>,
    assistant_api_format: Option<ApiFormat>,
}

async fn run_one_turn(
    db: DatabaseConnection,
    workspaces_dir: Option<PathBuf>,
    tool_calling: bool,
) -> Result<Outcome, Box<dyn Error>> {
    let user_id = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up("ada", "ada@example.com", "correct-horse")
        .await?
        .user
        .id;
    let offered = OfferedTools::default();
    let providers = ProviderService::new(
        db.clone(),
        "test-secret-key".to_owned(),
        RecordingConnector(Arc::clone(&offered)),
    );
    let provider_id = providers
        .create_custom(
            user_id,
            CreateCustomInput {
                api_format: ApiFormat::OpenAiCompatible,
                identifier: "main".to_owned(),
                name: "Main".to_owned(),
                base_url: "https://api.example.com/v1".to_owned(),
                api_key: "sk-test".to_owned(),
                api_path: String::new(),
                models_path: String::new(),
                models: vec![ProviderModel {
                    id: "model-a".to_owned(),
                    tool_calling,
                }],
            },
        )
        .await?
        .id;
    let sessions = SessionService::new(db);
    let session_id = sessions.create(user_id).await?.id;
    let agent = Agent::new(sessions.clone(), Arc::new(providers), workspaces_dir);
    let events = Mutex::new(Vec::new());

    agent
        .prepare(TurnRequest {
            user_id,
            session_id,
            provider_id,
            model: "model-a".to_owned(),
            content: "list the files".to_owned(),
        })
        .await?
        .run(|event| events.lock().unwrap_or_else(|e| e.into_inner()).push(event))
        .await?;

    let messages = sessions.all_messages(session_id).await?;
    Ok(Outcome {
        offered: offered.lock().unwrap_or_else(|e| e.into_inner()).clone(),
        tool_started: events
            .into_inner()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .any(|event| matches!(event, TurnEvent::ToolStarted { .. })),
        roles: messages.iter().map(|m| m.role().to_owned()).collect(),
        assistant_api_format: messages.get(1).and_then(|m| m.api_format),
    })
}

#[tokio::test]
async fn without_a_workspaces_dir_the_model_is_offered_no_tools() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let outcome = run_one_turn(db, None, true).await?;

        assert_eq!(
            outcome.offered,
            [Vec::<String>::new()],
            "one request without tools"
        );
        assert!(!outcome.tool_started, "no tool runs");
        assert_eq!(
            outcome.roles,
            ["user", "assistant"],
            "the turn stops after one step"
        );
        assert_eq!(
            outcome.assistant_api_format,
            Some(ApiFormat::OpenAiCompatible),
            "assistant records its producing format"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_model_without_tool_calling_gets_no_workspace_tools_and_runs_none()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let workspaces_dir = env::temp_dir().join(format!("lemma-agent-{}", Uuid::new_v4()));
        let outcome = run_one_turn(db, Some(workspaces_dir.clone()), false).await;
        fs::remove_dir_all(&workspaces_dir)?;
        let outcome = outcome?;

        assert_eq!(
            outcome.offered,
            [Vec::<String>::new()],
            "one request without tools"
        );
        assert!(!outcome.tool_started, "the requested tool does not run");
        assert_eq!(
            outcome.roles,
            ["user", "assistant"],
            "the turn stops after one step"
        );
        Ok(())
    })
    .await
}
