//! Turns assembled by an agent over migrated domains and a scripted model.

use std::env;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use futures::stream;
use lemma_agent::{Agent, AgentError, TurnEvent, TurnRequest};
use lemma_agent_loop::LoopError;
use lemma_auth::AuthService;
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, ToolCall};
use lemma_model::{
    Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest, ProviderKind,
};
use lemma_provider::{CreateInput, ProviderService};
use lemma_session::SessionService;
use lemma_test_db::on_each_database;
use sea_orm::{ConnectionTrait, DatabaseConnection};
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use serde_json::{Value, json};
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

/// Every request the model receives.
type Requests = Arc<Mutex<Vec<ModelRequest>>>;

/// Records each request; asks for one tool call on the first step, then
/// answers.
#[derive(Debug)]
struct RecordingAdapter {
    requests: Requests,
    call: Value,
}

impl Adapter for RecordingAdapter {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let mut requests = self.requests.lock().unwrap_or_else(|e| e.into_inner());
        let first = requests.is_empty();
        requests.push(req);
        let events = if first {
            vec![
                Ok(StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id: "call-1".into(),
                        name: self.call["name"].as_str().unwrap_or_default().into(),
                        arguments: self.call["arguments"].clone(),
                        started_at: None,
                        finished_at: None,
                    },
                }),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: None,
                }),
            ]
        } else {
            vec![Ok(StreamEvent::Done {
                stop_reason: StopReason::Stop,
                usage: None,
            })]
        };
        Ok(Box::pin(stream::iter(events)))
    }
}

struct RecordingConnector {
    requests: Requests,
    call: Value,
}

impl Connector for RecordingConnector {
    type Adapter = RecordingAdapter;

    fn connect(&self, _endpoint: Endpoint) -> RecordingAdapter {
        RecordingAdapter {
            requests: Arc::clone(&self.requests),
            call: self.call.clone(),
        }
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(vec![])
    }
}

/// A signed-up user with one provider whose model asks for `call`.
struct Setup {
    user_id: Uuid,
    provider_id: Uuid,
    sessions: SessionService,
    providers: Arc<ProviderService<RecordingConnector>>,
    requests: Requests,
}

impl Setup {
    async fn new(db: DatabaseConnection, call: Value) -> Result<Self, Box<dyn Error>> {
        let user_id = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
            .sign_up("ada", "ada@example.com", "correct-horse")
            .await?
            .user
            .id;
        let requests = Requests::default();
        let providers = ProviderService::new(
            db.clone(),
            "test-secret-key".to_owned(),
            RecordingConnector {
                requests: Arc::clone(&requests),
                call,
            },
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
        Ok(Self {
            user_id,
            provider_id,
            sessions: SessionService::new(db),
            providers: Arc::new(providers),
            requests,
        })
    }

    fn agent(&self, workspaces_dir: Option<PathBuf>) -> Agent<RecordingConnector> {
        Agent::new(
            self.sessions.clone(),
            Arc::clone(&self.providers),
            workspaces_dir,
        )
    }

    fn request(&self, session_id: Uuid) -> TurnRequest {
        TurnRequest {
            user_id: self.user_id,
            session_id,
            provider_id: self.provider_id,
            model: "model-a".to_owned(),
            content: "look around".to_owned(),
        }
    }

    fn requests(&self) -> Vec<ModelRequest> {
        self.requests
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
}

/// A temporary directory removed when dropped.
struct TempDir(PathBuf);

impl TempDir {
    fn new(name: &str) -> Result<Self, Box<dyn Error>> {
        let dir = env::temp_dir().join(format!("lemma-agent-{name}-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir)?;
        Ok(Self(dir))
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn read_marker() -> Value {
    json!({ "name": "read_file", "arguments": { "path": "marker.txt" } })
}

#[tokio::test]
async fn without_a_workspaces_dir_the_model_is_offered_no_tools() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let setup = Setup::new(db, read_marker()).await?;
        let session_id = setup.sessions.create(setup.user_id, None).await?.id;
        let events = Mutex::new(Vec::new());

        setup
            .agent(None)
            .prepare(setup.request(session_id))
            .await?
            .run(|event| events.lock().unwrap_or_else(|e| e.into_inner()).push(event))
            .await?;

        let requests = setup.requests();
        assert_eq!(requests.len(), 1, "one request");
        assert!(
            requests[0].tools.is_empty() && requests[0].system_prompt.is_none(),
            "no tools and no system prompt"
        );
        let events = events.into_inner().unwrap_or_else(|e| e.into_inner());
        assert!(
            !events
                .iter()
                .any(|event| matches!(event, TurnEvent::ToolStarted { .. })),
            "no tool runs: {events:?}"
        );
        let messages = setup.sessions.all_messages(session_id).await?;
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

#[tokio::test]
async fn a_session_deleted_after_its_turn_is_prepared_fails_the_turn() -> Result<(), Box<dyn Error>>
{
    on_each_database::<Migrator, _, _>(|db| async move {
        let setup = Setup::new(db, read_marker()).await?;
        let session_id = setup.sessions.create(setup.user_id, None).await?.id;
        let turn = setup.agent(None).prepare(setup.request(session_id)).await?;
        setup.sessions.delete(setup.user_id, session_id).await?;

        let ran = turn.run(|_| {}).await;

        assert!(
            matches!(ran, Err(AgentError::Loop(LoopError::NotFound(_)))),
            "{ran:?}"
        );
        assert!(setup.requests().is_empty(), "the model is not called");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_bound_session_runs_its_tools_in_its_directory() -> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("workspaces")?;
    let bound = TempDir::new("bound")?;
    fs::write(bound.0.join("marker.txt"), "here")?;
    on_each_database::<Migrator, _, _>(|db| {
        let (workspaces, bound) = (workspaces.0.clone(), bound.0.clone());
        async move {
            let setup = Setup::new(db, read_marker()).await?;
            let session = setup.sessions.create(setup.user_id, Some(&bound)).await?;
            let Some(directory) = session.directory else {
                return Err("the session stores its directory".into());
            };

            setup
                .agent(Some(workspaces.clone()))
                .prepare(setup.request(session.id))
                .await?
                .run(|_| {})
                .await?;

            let requests = setup.requests();
            let prompt = requests[0].system_prompt.clone().unwrap_or_default();
            assert!(
                prompt.contains(&directory) && prompt.contains(env::consts::OS),
                "{prompt}"
            );
            let messages = setup.sessions.all_messages(session.id).await?;
            let tool_output = messages.iter().find_map(|m| match &m.body.0 {
                Message::ToolResult { content, .. } => match content.first() {
                    Some(ContentBlock::Text(text)) => Some(text.text.clone()),
                    _ => None,
                },
                _ => None,
            });
            assert_eq!(
                tool_output.as_deref(),
                Some("\"here\""),
                "read in the directory"
            );
            assert!(
                !workspaces.join(session.id.to_string()).exists(),
                "no workspace is generated"
            );
            Ok(())
        }
    })
    .await
}

#[tokio::test]
async fn a_turn_fails_once_the_bound_directory_is_gone() -> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("workspaces")?;
    on_each_database::<Migrator, _, _>(|db| {
        let workspaces = workspaces.0.clone();
        async move {
            let setup = Setup::new(db, read_marker()).await?;
            let bound = TempDir::new("gone")?;
            let session = setup.sessions.create(setup.user_id, Some(&bound.0)).await?;
            drop(bound);

            let prepared = setup
                .agent(Some(workspaces))
                .prepare(setup.request(session.id))
                .await;

            assert!(
                matches!(&prepared, Err(AgentError::DirectoryNotFound(dir)) if Some(dir) == session.directory.as_ref()),
                "{prepared:?}"
            );
            assert!(
                setup.sessions.all_messages(session.id).await?.is_empty(),
                "nothing is written"
            );
            Ok(())
        }
    })
    .await
}

#[tokio::test]
async fn a_turn_on_a_session_the_user_does_not_own_creates_nothing() -> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("workspaces")?;
    on_each_database::<Migrator, _, _>(|db| {
        let workspaces = workspaces.0.clone();
        async move {
            let setup = Setup::new(db, read_marker()).await?;
            let session_id = Uuid::new_v4();

            let prepared = setup
                .agent(Some(workspaces.clone()))
                .prepare(setup.request(session_id))
                .await;

            assert!(
                matches!(prepared, Err(AgentError::SessionNotFound)),
                "{prepared:?}"
            );
            assert!(
                !workspaces.join(session_id.to_string()).exists(),
                "no workspace is created"
            );
            Ok(())
        }
    })
    .await
}

#[tokio::test]
async fn a_session_database_failure_fails_the_turn() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let setup = Setup::new(db.clone(), read_marker()).await?;
        db.execute_unprepared("DROP TABLE messages").await?;
        db.execute_unprepared("DROP TABLE sessions").await?;

        let prepared = setup
            .agent(None)
            .prepare(setup.request(Uuid::new_v4()))
            .await;

        assert!(
            matches!(prepared, Err(AgentError::Store(_))),
            "{prepared:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_workspace_under_a_file_cannot_be_created() -> Result<(), Box<dyn Error>> {
    let parent = TempDir::new("file-parent")?;
    let file = parent.0.join("file");
    fs::write(&file, "x")?;
    on_each_database::<Migrator, _, _>(|db| {
        let file = file.clone();
        async move {
            let setup = Setup::new(db, read_marker()).await?;
            let session_id = setup.sessions.create(setup.user_id, None).await?.id;

            let prepared = setup
                .agent(Some(file))
                .prepare(setup.request(session_id))
                .await;

            assert!(
                matches!(prepared, Err(AgentError::Workspace(_))),
                "{prepared:?}"
            );
            Ok(())
        }
    })
    .await
}
