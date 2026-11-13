//! Turns started, resumed, and aborted by an agent over migrated domains.

use std::env;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use futures::{StreamExt, stream};
use lemma_adapter::ReqwestTransport;
use lemma_agent::{Agent, AgentError, TurnEvent, TurnRequest};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent, ToolCall};
use lemma_model::{
    Adapter, ApiFormat, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest,
};
use lemma_provider::{
    CreateCustomInput, ProviderModel, ProviderService, UpdateWebInput, WebProviderKind,
};
use lemma_session::SessionService;
use serde_json::{Value, json};
use sqlx::SqlitePool;
use uuid::Uuid;

type Requests = Arc<Mutex<Vec<ModelRequest>>>;

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

struct StalledAdapter;

impl Adapter for StalledAdapter {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let head = stream::iter([
            Ok(StreamEvent::TextStart),
            Ok(StreamEvent::TextDelta {
                delta: "partial".into(),
            }),
        ]);
        Ok(Box::pin(head.chain(stream::pending())))
    }
}

struct StalledConnector;

impl Connector for StalledConnector {
    type Adapter = StalledAdapter;

    fn connect(&self, _endpoint: Endpoint) -> StalledAdapter {
        StalledAdapter
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(vec![])
    }
}

struct Setup {
    provider_id: Uuid,
    sessions: SessionService,
    providers: Arc<ProviderService<RecordingConnector>>,
    requests: Requests,
}

impl Setup {
    async fn new(db: SqlitePool, call: Value) -> Result<Self, Box<dyn Error>> {
        Self::with_model(db, call, true).await
    }

    async fn with_model(
        db: SqlitePool,
        call: Value,
        tool_calling: bool,
    ) -> Result<Self, Box<dyn Error>> {
        let requests = Requests::default();
        let providers = ProviderService::new(
            db.clone(),
            "test-secret-key",
            RecordingConnector {
                requests: Arc::clone(&requests),
                call,
            },
        );
        let provider_id = providers
            .create_custom(CreateCustomInput {
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
            })
            .await?
            .id;
        Ok(Self {
            provider_id,
            sessions: SessionService::new(db),
            providers: Arc::new(providers),
            requests,
        })
    }

    fn agent(&self, workspaces_dir: PathBuf) -> Agent<RecordingConnector> {
        Agent::new(
            self.sessions.clone(),
            Arc::clone(&self.providers),
            workspaces_dir,
            None,
        )
    }

    fn agent_with_web(&self, workspaces_dir: PathBuf) -> Agent<RecordingConnector> {
        Agent::new(
            self.sessions.clone(),
            Arc::clone(&self.providers),
            workspaces_dir,
            Some(ReqwestTransport::new()),
        )
    }

    fn request(&self, session_id: Uuid) -> TurnRequest {
        TurnRequest {
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
async fn a_model_without_tool_calling_gets_no_workspace_tools_and_runs_none()
-> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("no-tools")?;
    let db = lemma_db::in_memory().await?;
    let setup = Setup::with_model(db, read_marker(), false).await?;
    let session_id = setup.sessions.create(None).await?.id;

    let events: Vec<_> = setup
        .agent(workspaces.0.clone())
        .start(setup.request(session_id))
        .await?
        .collect()
        .await;

    let requests = setup.requests();
    assert_eq!(requests.len(), 1, "single model step");
    assert!(requests[0].tools.is_empty(), "one request without tools");
    assert!(
        matches!(events.first(), Some(TurnEvent::UserAppended { .. })),
        "starts with UserAppended: {events:?}"
    );
    assert!(
        events
            .iter()
            .any(|event| matches!(event, TurnEvent::AssistantStarted { .. })),
        "includes AssistantStarted: {events:?}"
    );
    assert!(
        !events
            .iter()
            .any(|event| matches!(event, TurnEvent::ToolStarted { .. })),
        "the requested tool does not run"
    );
    let messages = setup.sessions.all_messages(session_id).await?;
    let roles: Vec<&str> = messages.iter().map(|m| m.role()).collect();
    assert_eq!(roles, ["user", "assistant"], "stored roles");
    Ok(())
}

#[tokio::test]
async fn a_web_transport_adds_web_tools_following_enabled_backends() -> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("web")?;
    let db = lemma_db::in_memory().await?;
    let setup = Setup::new(db.clone(), read_marker()).await?;
    let s1 = setup.sessions.create(None).await?.id;
    let _: Vec<_> = setup
        .agent_with_web(workspaces.0.clone())
        .start(setup.request(s1))
        .await?
        .collect()
        .await;
    let mut names: Vec<_> = setup.requests()[0]
        .tools
        .iter()
        .map(|t| t.name.clone())
        .collect();
    names.sort();
    assert_eq!(
        names,
        ["bash", "read_file", "web_fetch", "write_file"],
        "default native fetch"
    );

    for provider in setup.providers.list_web().await? {
        if provider.kind != WebProviderKind::Native {
            setup
                .providers
                .update_web(
                    provider.id,
                    UpdateWebInput {
                        api_key: Some("web-test-key".to_owned()),
                        enabled: Some(true),
                    },
                )
                .await?;
        }
    }
    setup
        .requests
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear();
    let s2 = setup.sessions.create(None).await?.id;
    let _: Vec<_> = setup
        .agent_with_web(workspaces.0.clone())
        .start(setup.request(s2))
        .await?
        .collect()
        .await;
    let offered = &setup.requests()[0].tools;
    let mut names: Vec<_> = offered.iter().map(|t| t.name.clone()).collect();
    names.sort();
    assert_eq!(
        names,
        ["bash", "read_file", "web_fetch", "web_search", "write_file"],
        "search added when enabled"
    );
    let search = offered
        .iter()
        .find(|t| t.name == "web_search")
        .ok_or("missing")?;
    assert!(
        search.description.contains("Exa"),
        "description names active backend"
    );

    for provider in setup.providers.list_web().await? {
        setup
            .providers
            .update_web(
                provider.id,
                UpdateWebInput {
                    api_key: None,
                    enabled: Some(false),
                },
            )
            .await?;
    }
    setup
        .requests
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear();
    let s3 = setup.sessions.create(None).await?.id;
    let _: Vec<_> = setup
        .agent_with_web(workspaces.0.clone())
        .start(setup.request(s3))
        .await?
        .collect()
        .await;
    let mut names: Vec<_> = setup.requests()[0]
        .tools
        .iter()
        .map(|t| t.name.clone())
        .collect();
    names.sort();
    assert_eq!(
        names,
        ["bash", "read_file", "write_file"],
        "web tools omitted when disabled"
    );

    sqlx::query("DROP TABLE web_providers").execute(&db).await?;
    assert!(
        matches!(
            setup
                .agent_with_web(workspaces.0.clone())
                .start(setup.request(s2))
                .await,
            Err(AgentError::Provider(_))
        ),
        "broken web_providers fails start"
    );
    Ok(())
}

#[tokio::test]
async fn a_bound_session_runs_its_tools_in_its_directory_and_rejects_missing_ones()
-> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("workspaces")?;
    let bound = TempDir::new("bound")?;
    fs::write(bound.0.join("marker.txt"), "here")?;
    let db = lemma_db::in_memory().await?;
    let setup = Setup::new(db, read_marker()).await?;
    let session = setup.sessions.create(Some(&bound.0)).await?;
    let Some(directory) = session.directory else {
        return Err("the session stores its directory".into());
    };
    let _: Vec<_> = setup
        .agent(workspaces.0.clone())
        .start(setup.request(session.id))
        .await?
        .collect()
        .await;
    let prompt = setup.requests()[0]
        .system_prompt
        .clone()
        .unwrap_or_default();
    assert!(
        prompt.contains(&directory) && prompt.contains(env::consts::OS),
        "system prompt describes directory and OS"
    );
    let messages = setup.sessions.all_messages(session.id).await?;
    let tool_output = messages.iter().find_map(|m| match &m.body.0 {
        Message::ToolResult { content, .. } => match content.first() {
            Some(ContentBlock::Text(TextContent { text })) => Some(text.clone()),
            _ => None,
        },
        _ => None,
    });
    assert_eq!(
        tool_output.as_deref(),
        Some("\"here\""),
        "tool ran in bound dir"
    );
    assert!(
        !workspaces.0.join(session.id.to_string()).exists(),
        "no generated workspace for bound session"
    );

    let gone = TempDir::new("gone")?;
    let s2 = setup.sessions.create(Some(&gone.0)).await?;
    drop(gone);
    let started = setup
        .agent(workspaces.0.clone())
        .start(setup.request(s2.id))
        .await;
    assert!(
        matches!(started, Err(AgentError::DirectoryNotFound(_))),
        "missing bound directory rejected"
    );
    Ok(())
}

#[tokio::test]
async fn start_validates_inputs_missing_entities_broken_stores_and_bad_workspaces()
-> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("workspaces")?;
    let file = workspaces.0.join("file");
    fs::write(&file, "x")?;
    let db = lemma_db::in_memory().await?;
    let setup = Setup::new(db.clone(), read_marker()).await?;
    let session_id = setup.sessions.create(None).await?.id;
    let agent = setup.agent(workspaces.0.clone());

    assert!(
        matches!(
            agent
                .start(TurnRequest {
                    content: "   ".to_owned(),
                    ..setup.request(session_id)
                })
                .await,
            Err(AgentError::ContentRequired)
        ),
        "blank content rejected"
    );
    assert!(
        matches!(
            agent
                .start(TurnRequest {
                    model: "   ".to_owned(),
                    ..setup.request(session_id)
                })
                .await,
            Err(AgentError::ModelRequired)
        ),
        "blank model rejected"
    );
    assert!(
        matches!(
            agent
                .start(TurnRequest {
                    provider_id: Uuid::new_v4(),
                    ..setup.request(session_id)
                })
                .await,
            Err(AgentError::ProviderNotFound)
        ),
        "missing provider rejected"
    );

    let unowned = Uuid::new_v4();
    assert!(
        matches!(
            agent.start(setup.request(unowned)).await,
            Err(AgentError::SessionNotFound)
        ),
        "missing session rejected"
    );
    assert!(
        !workspaces.0.join(unowned.to_string()).exists(),
        "no workspace created for missing session"
    );

    assert!(
        matches!(
            setup.agent(file).start(setup.request(session_id)).await,
            Err(AgentError::Workspace(_))
        ),
        "bad workspace path rejected"
    );

    sqlx::query("DROP TABLE messages").execute(&db).await?;
    sqlx::query("DROP TABLE sessions").execute(&db).await?;
    assert!(
        matches!(
            agent.start(setup.request(Uuid::new_v4())).await,
            Err(AgentError::Store(_))
        ),
        "dropped tables report store error"
    );
    Ok(())
}

#[tokio::test]
async fn resume_replays_from_offset_and_abort_stops_a_running_turn() -> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("live")?;
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db.clone());
    let providers = Arc::new(ProviderService::new(
        db,
        "test-secret-key",
        StalledConnector,
    ));
    let provider_id = providers
        .create_custom(CreateCustomInput {
            api_format: ApiFormat::OpenAiCompatible,
            identifier: "stalled".to_owned(),
            name: "Stalled".to_owned(),
            base_url: "https://api.example.com/v1".to_owned(),
            api_key: "sk-test".to_owned(),
            api_path: String::new(),
            models_path: String::new(),
            models: Vec::new(),
        })
        .await?
        .id;
    let session_id = sessions.create(None).await?.id;
    let agent: Agent<_> = Agent::new(sessions, providers, workspaces.0.clone(), None);

    let mut live = Box::pin(
        agent
            .start(TurnRequest {
                session_id,
                provider_id,
                model: "model-a".to_owned(),
                content: "wait".to_owned(),
            })
            .await?,
    );

    let Some(TurnEvent::UserAppended {
        id: user_message_id,
        ..
    }) = live.next().await
    else {
        return Err("expected UserAppended first".into());
    };
    while let Some(event) = live.next().await {
        if matches!(event, TurnEvent::Delta { .. }) {
            break;
        }
    }

    assert!(
        agent.resume(Uuid::new_v4(), 0).is_none(),
        "unknown turn is not resumable"
    );
    let mut from_zero = Box::pin(
        agent
            .resume(user_message_id, 0)
            .ok_or("running turn should resume from 0")?,
    );
    let mut from_two = Box::pin(
        agent
            .resume(user_message_id, 2)
            .ok_or("running turn should resume from offset 2")?,
    );

    agent.abort(Uuid::new_v4());
    agent.abort(user_message_id);

    let replayed: Vec<_> = from_zero.as_mut().collect().await;
    let tail: Vec<_> = from_two.as_mut().collect().await;
    assert!(
        matches!(replayed.first(), Some(TurnEvent::UserAppended { .. })),
        "offset 0 replays UserAppended: {replayed:?}"
    );
    assert!(
        matches!(replayed.last(), Some(TurnEvent::TurnAborted { .. })),
        "abort terminates stream with TurnAborted: {replayed:?}"
    );
    assert_eq!(
        tail.len() + 2,
        replayed.len(),
        "offset 2 skips the first two events"
    );
    assert!(
        agent.resume(user_message_id, 0).is_none(),
        "completed turn is removed from running set"
    );
    Ok(())
}

#[tokio::test]
async fn mid_turn_persistence_failure_emits_turn_failed() -> Result<(), Box<dyn Error>> {
    let workspaces = TempDir::new("mid-turn-fail")?;
    let db = lemma_db::in_memory().await?;
    let sessions = SessionService::new(db.clone());
    let providers = Arc::new(ProviderService::new(
        db.clone(),
        "test-secret-key",
        StalledConnector,
    ));
    let provider_id = providers
        .create_custom(CreateCustomInput {
            api_format: ApiFormat::OpenAiCompatible,
            identifier: "stalled".to_owned(),
            name: "Stalled".to_owned(),
            base_url: "https://api.example.com/v1".to_owned(),
            api_key: "sk-test".to_owned(),
            api_path: String::new(),
            models_path: String::new(),
            models: Vec::new(),
        })
        .await?
        .id;
    let session_id = sessions.create(None).await?.id;
    let agent: Agent<_> = Agent::new(sessions, providers, workspaces.0.clone(), None);

    let mut live = Box::pin(
        agent
            .start(TurnRequest {
                session_id,
                provider_id,
                model: "model-a".to_owned(),
                content: "trigger store failure".to_owned(),
            })
            .await?,
    );

    let mut user_message_id = None;
    let mut events = Vec::new();
    while let Some(event) = live.next().await {
        if let TurnEvent::UserAppended { id, .. } = &event {
            user_message_id = Some(*id);
        }
        if matches!(event, TurnEvent::Delta { .. }) {
            sqlx::query("DROP TABLE messages").execute(&db).await?;
            if let Some(id) = user_message_id {
                agent.abort(id);
            }
        }
        events.push(event);
    }

    assert!(
        matches!(events.last(), Some(TurnEvent::TurnFailed { .. })),
        "store failure during settle emits TurnFailed: {events:?}"
    );
    Ok(())
}
