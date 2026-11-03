use std::path::{Path, PathBuf};
use std::sync::Arc;

use dashmap::DashMap;
use lemma_agent_loop::{AgentLoop, CancelToken, ToolRuntime, TurnEvent, TurnInput};
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::{Adapter, Connector};
use lemma_provider::ProviderService;
use lemma_session::{LastModel, SessionService};
use lemma_tool::{BashTool, LocalExecEnv, ReadFileTool, ToolRegistry, WriteFileTool};
use tokio::fs;
use uuid::Uuid;

use crate::agent_error::AgentError;

/// What a user asks one turn to do.
#[derive(Debug)]
pub struct TurnRequest {
    /// Authenticated caller.
    pub user_id: Uuid,
    /// Session the turn continues from its active leaf.
    pub session_id: Uuid,
    /// Provider the turn is dispatched to.
    pub provider_id: Uuid,
    /// Model id on that provider.
    pub model: String,
    /// User message text.
    pub content: String,
}

/// A running turn: the user that owns it and its cancel token.
#[derive(Debug)]
struct RunningTurn {
    user_id: Uuid,
    cancel: CancelToken,
}

/// Running turns by user message id.
type RunningTurns = DashMap<Uuid, RunningTurn>;

/// Assembles and runs turns, and aborts the ones still running.
///
/// With `workspaces_dir` set, each session's tools (`read_file`,
/// `write_file`, `bash`) run in `<workspaces_dir>/<session id>`;
/// without it, turns call the model without tools.
#[derive(Debug)]
pub struct Agent<C> {
    sessions: SessionService,
    providers: Arc<ProviderService<C>>,
    workspaces_dir: Option<PathBuf>,
    running: Arc<RunningTurns>,
}

impl<C: Connector> Agent<C> {
    /// Creates the agent over the session and provider domains.
    pub fn new(
        sessions: SessionService,
        providers: Arc<ProviderService<C>>,
        workspaces_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            sessions,
            providers,
            workspaces_dir,
            running: Arc::default(),
        }
    }

    /// Validates the request and assembles its turn: opens the provider's
    /// adapter and prepares the workspace.
    /// The turn is abortable from here until it is dropped.
    ///
    /// # Errors
    ///
    /// [`AgentError::ContentRequired`] or [`AgentError::ModelRequired`] for
    /// blank content or model, [`AgentError::ProviderNotFound`] when the user
    /// owns no such provider, [`AgentError::Provider`] when opening it
    /// fails, and [`AgentError::Workspace`] when the workspace cannot be
    /// created.
    pub async fn prepare(&self, req: TurnRequest) -> Result<Turn<C::Adapter>, AgentError> {
        if req.content.trim().is_empty() {
            return Err(AgentError::ContentRequired);
        }
        if req.model.trim().is_empty() {
            return Err(AgentError::ModelRequired);
        }
        let adapter = self.providers.adapter(req.user_id, req.provider_id).await?;

        let tools = workspace_tools(self.workspaces_dir.as_deref(), req.session_id).await?;
        let agent_loop = AgentLoop::new(self.sessions.clone(), adapter, tools);

        let user_message_id = Uuid::new_v4();
        let cancel = CancelToken::new();
        self.running.insert(
            user_message_id,
            RunningTurn {
                user_id: req.user_id,
                cancel: cancel.clone(),
            },
        );
        Ok(Turn {
            agent_loop,
            input: TurnInput {
                user_id: req.user_id,
                session_id: req.session_id,
                user_message_id,
                user_message: Message::User {
                    content: vec![ContentBlock::Text(TextContent { text: req.content })],
                },
                model: LastModel {
                    provider_id: req.provider_id,
                    model: req.model,
                },
            },
            cancel,
            _registration: Registration {
                running: Arc::clone(&self.running),
                user_message_id,
            },
        })
    }

    /// Aborts the user's running turn started by `user_message_id`; other
    /// ids are ignored.
    pub fn abort(&self, user_id: Uuid, user_message_id: Uuid) {
        if let Some(turn) = self.running.get(&user_message_id)
            && turn.user_id == user_id
        {
            turn.cancel.cancel();
        }
    }
}

/// One assembled turn, ready to run.
#[derive(Debug)]
pub struct Turn<A> {
    agent_loop: AgentLoop<A, LocalExecEnv>,
    input: TurnInput,
    cancel: CancelToken,
    _registration: Registration,
}

impl<A: Adapter> Turn<A> {
    /// The id of the user message this turn appends; abort and resume
    /// address the turn by it.
    #[must_use]
    pub fn user_message_id(&self) -> Uuid {
        self.input.user_message_id
    }

    /// Runs the turn to its end, reporting progress to `observer`.
    ///
    /// # Errors
    ///
    /// [`AgentError::Loop`] when the loop fails.
    pub async fn run(self, observer: impl Fn(TurnEvent) + Send + Sync) -> Result<(), AgentError> {
        Ok(self
            .agent_loop
            .run_turn(self.input, &observer, &self.cancel)
            .await?)
    }
}

/// Removes a turn from the running set when the turn is dropped.
#[derive(Debug)]
struct Registration {
    running: Arc<RunningTurns>,
    user_message_id: Uuid,
}

impl Drop for Registration {
    fn drop(&mut self) {
        self.running.remove(&self.user_message_id);
    }
}

/// Prepares `<workspaces_dir>/<session_id>` and the tools that run in
/// it; `None` without a workspaces directory.
async fn workspace_tools(
    workspaces_dir: Option<&Path>,
    session_id: Uuid,
) -> Result<Option<ToolRuntime<LocalExecEnv>>, AgentError> {
    let Some(dir) = workspaces_dir else {
        return Ok(None);
    };
    let workspace = dir.join(session_id.to_string());
    fs::create_dir_all(&workspace)
        .await
        .map_err(|e| AgentError::Workspace(e.to_string()))?;
    let mut registry = ToolRegistry::new();
    registry.register(ReadFileTool);
    registry.register(WriteFileTool);
    registry.register(BashTool);
    Ok(Some(ToolRuntime::new(
        registry,
        LocalExecEnv::new(workspace),
    )))
}
