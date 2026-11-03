//! Turns assembled by an agent over migrated domains and a scripted model.

use std::error::Error;
use std::sync::{Arc, Mutex};

use futures::stream;
use lemma_agent::{Agent, TurnEvent, TurnRequest};
use lemma_auth::AuthService;
use lemma_core::{StopReason, StreamEvent, ToolCall};
use lemma_model::{
    Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest, ProviderKind,
};
use lemma_provider::{CreateInput, ProviderService};
use lemma_session::SessionService;
use lemma_test_db::on_each_database;
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use serde_json::json;

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

#[tokio::test]
async fn without_a_workspaces_dir_the_model_is_offered_no_tools() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
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
            .create(
                user_id,
                CreateInput {
                    kind: ProviderKind::OpenAiCompatible,
                    identifier: "main".to_owned(),
                    name: "Main".to_owned(),
                    base_url: "https://api.example.com/v1".to_owned(),
                    api_key: "sk-test".to_owned(),
                    api_path: String::new(),
                    models_path: String::new(),
                    models: vec!["model-a".to_owned()],
                },
            )
            .await?
            .id;
        let sessions = SessionService::new(db);
        let session_id = sessions.create(user_id).await?.id;
        let agent = Agent::new(sessions.clone(), Arc::new(providers), None);
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

        let offered = offered.lock().unwrap_or_else(|e| e.into_inner()).clone();
        assert_eq!(offered, [Vec::<String>::new()], "one request without tools");
        let events = events.into_inner().unwrap_or_else(|e| e.into_inner());
        assert!(
            !events
                .iter()
                .any(|event| matches!(event, TurnEvent::ToolStarted { .. })),
            "no tool runs: {events:?}"
        );
        let messages = sessions.all_messages(session_id).await?;
        let roles: Vec<&str> = messages.iter().map(|m| m.role()).collect();
        assert_eq!(
            roles,
            ["user", "assistant"],
            "the turn stops after one step"
        );
        Ok(())
    })
    .await
}
