use std::env;
use std::fmt::Debug;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::Utc;
use futures::Stream;
use lemma_adapter::{HttpTransport, ReqwestTransport};
use lemma_agent_loop::{AgentLoop, LoopError, ToolRuntime, TurnEvent, TurnInput};
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::Connector;
use lemma_provider::ProviderService;
use lemma_session::{BranchTarget, LastModel, Session, SessionService};
use lemma_tool::{BashTool, CancelToken, LocalExecEnv, ReadFileTool, ToolRegistry, WriteFileTool};
use tokio::fs;
use uuid::Uuid;

use crate::agent_error::AgentError;
use crate::running_turns::RunningTurns;
use crate::web_tools;

/// What a user asks one turn to do.
#[derive(Debug)]
pub struct TurnRequest {
    /// Session the turn belongs to.
    pub session_id: Uuid,
    /// Provider the turn is dispatched to.
    pub provider_id: Uuid,
    /// Model id on that provider.
    pub model: String,
    /// User message text.
    pub content: String,
    /// Branch point for the new user message.
    pub branch: BranchTarget,
}

/// Starts, resumes, and aborts turns.
///
/// A session's tools (`read_file`, `write_file`, `bash`) run in the directory
/// the session is bound to, or else in `<workspaces_dir>/<session id>`, and
/// the model is told the directory, the operating system, and the shell.
#[derive(Debug)]
pub struct Agent<C, T = ReqwestTransport> {
    sessions: SessionService,
    providers: Arc<ProviderService<C>>,
    workspaces_dir: PathBuf,
    web_http: Option<T>,
    running: Arc<RunningTurns>,
}

impl<C: Connector, T: HttpTransport + Debug> Agent<C, T> {
    /// Creates the agent over the session and provider domains.
    #[must_use]
    pub fn new(
        sessions: SessionService,
        providers: Arc<ProviderService<C>>,
        workspaces_dir: PathBuf,
        web_http: Option<T>,
    ) -> Self {
        Self {
            sessions,
            providers,
            workspaces_dir,
            web_http,
            running: Arc::default(),
        }
    }

    /// Validates `req`, spawns the turn in the background, and returns a live
    /// stream of its [`TurnEvent`]s from the beginning.
    ///
    /// Dropping the returned stream leaves the turn running; callers reconnect
    /// with [`Self::resume`] and stop it early with [`Self::abort`]. Any
    /// mid-turn failure after startup is delivered as a terminal
    /// [`TurnEvent::TurnFailed`] on the stream.
    ///
    /// # Errors
    ///
    /// [`AgentError::ContentRequired`] or [`AgentError::ModelRequired`] for
    /// blank content or model, [`AgentError::SessionBusy`] when the session
    /// already has a running turn, [`AgentError::ProviderNotFound`] when the
    /// provider is absent, [`AgentError::Provider`] when opening it fails,
    /// [`AgentError::SessionNotFound`] when the session is absent,
    /// [`AgentError::MessageNotFound`] or [`AgentError::InvalidBranchPoint`]
    /// when the branch target is missing or invalid, [`AgentError::Store`] when
    /// the session database fails, [`AgentError::DirectoryNotFound`] when the
    /// session's directory is gone, and [`AgentError::Workspace`] when the
    /// workspace cannot be created.
    pub async fn start(
        &self,
        req: TurnRequest,
    ) -> Result<impl Stream<Item = TurnEvent> + Send + 'static + use<C, T>, AgentError> {
        if req.content.trim().is_empty() {
            return Err(AgentError::ContentRequired);
        }
        if req.model.trim().is_empty() {
            return Err(AgentError::ModelRequired);
        }
        let user_message_id = Uuid::new_v4();
        let claim = self
            .running
            .claim_session(req.session_id, user_message_id)
            .ok_or(AgentError::SessionBusy)?;
        let (session, parent_id, previous_api_format) = self
            .sessions
            .resolve_branch_parent(req.session_id, req.branch)
            .await?;
        let lemma_provider::ProviderBinding {
            adapter,
            api_format,
            tool_calling,
        } = self
            .providers
            .bind(req.provider_id, &req.model, previous_api_format)
            .await?;

        let cancel = CancelToken::new();
        let tools = session_tools(
            &self.workspaces_dir,
            &session,
            &cancel,
            &self.providers,
            self.web_http.as_ref(),
        )
        .await?;
        let system_prompt = Some(system_prompt(tools.env.root()));
        let agent_loop = AgentLoop::new(self.sessions.clone(), adapter, Some(tools));

        let input = TurnInput {
            session_id: req.session_id,
            user_message_id,
            parent_id,
            user_message: Message::User {
                content: vec![ContentBlock::Text(TextContent { text: req.content })],
            },
            model: LastModel {
                provider_id: req.provider_id,
                model: req.model,
            },
            api_format,
            tool_calling,
            system_prompt,
        };
        let (writer, events) = claim.into_turn(cancel.clone());
        tokio::spawn(async move {
            match agent_loop
                .run_turn(input, &|ev| writer.push(ev), &cancel)
                .await
            {
                Ok(()) | Err(LoopError::Model(_)) => {}
                Err(err) => writer.push(TurnEvent::TurnFailed {
                    message: err.to_string(),
                    at: Utc::now(),
                }),
            }
        });
        Ok(events)
    }

    /// Replays and follows the events of the running turn identified by
    /// `message_id` starting at `offset`, or returns `None` when no such turn
    /// is running.
    #[must_use]
    pub fn resume(
        &self,
        message_id: Uuid,
        offset: usize,
    ) -> Option<impl Stream<Item = TurnEvent> + Send + 'static + use<C, T>> {
        self.running.resume(message_id, offset)
    }

    /// Cancels the running turn started by `message_id`; unknown IDs are
    /// ignored.
    pub fn abort(&self, message_id: Uuid) {
        self.running.abort(message_id);
    }

    /// User message ID of the turn currently running on `session_id`, if any.
    #[must_use]
    pub fn active_turn(&self, session_id: Uuid) -> Option<Uuid> {
        self.running.active_turn(session_id)
    }
}

async fn session_tools<C: Connector, T: HttpTransport + Debug>(
    workspaces_dir: &Path,
    session: &Session,
    cancel: &CancelToken,
    providers: &ProviderService<C>,
    web_http: Option<&T>,
) -> Result<ToolRuntime<LocalExecEnv>, AgentError> {
    let env = match &session.directory {
        Some(directory) => LocalExecEnv::open(Path::new(directory), cancel.clone())
            .await
            .map_err(|_| AgentError::DirectoryNotFound(directory.clone()))?,
        None => open_workspace(&workspaces_dir.join(session.id.to_string()), cancel)
            .await
            .map_err(|e| AgentError::Workspace(e.to_string()))?,
    };
    let mut registry = ToolRegistry::new();
    registry.register(ReadFileTool);
    registry.register(WriteFileTool);
    registry.register(BashTool);
    if let Some(transport) = web_http {
        web_tools::register_web_tools(&mut registry, providers, transport).await?;
    }
    Ok(ToolRuntime::new(registry, env))
}

async fn open_workspace(workspace: &Path, cancel: &CancelToken) -> io::Result<LocalExecEnv> {
    fs::create_dir_all(workspace).await?;
    LocalExecEnv::open(workspace, cancel.clone()).await
}

fn system_prompt(directory: &Path) -> String {
    format!(
        "Your working directory is {}. The operating system is {}. The bash tool runs \
         commands in {}, starting in the working directory.",
        directory.display(),
        env::consts::OS,
        LocalExecEnv::SHELL,
    )
}
