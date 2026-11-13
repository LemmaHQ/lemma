use std::env;
use std::fmt::Debug;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use dashmap::DashMap;
use lemma_adapter::{HttpTransport, ReqwestTransport};
use lemma_agent_loop::{AgentLoop, ToolRuntime, TurnEvent, TurnInput};
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::{Adapter, Connector};
use lemma_provider::ProviderService;
use lemma_session::{LastModel, Session, SessionService};
use lemma_tool::{BashTool, CancelToken, LocalExecEnv, ReadFileTool, ToolRegistry, WriteFileTool};
use tokio::fs;
use uuid::Uuid;

use crate::agent_error::AgentError;
use crate::web_tools;

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
/// With `workspaces_dir` set, a session's tools (`read_file`, `write_file`,
/// `bash`) run in the directory the session is bound to, or else in
/// `<workspaces_dir>/<session id>`, and the model is told the directory,
/// the operating system, and the shell; without it, turns call the model
/// without tools.
#[derive(Debug)]
pub struct Agent<C, T = ReqwestTransport> {
    sessions: SessionService,
    providers: Arc<ProviderService<C>>,
    workspaces_dir: Option<PathBuf>,
    web_http: Option<T>,
    running: Arc<RunningTurns>,
}

impl<C: Connector, T: HttpTransport + Debug> Agent<C, T> {
    /// Creates the agent over the session and provider domains.
    pub fn new(
        sessions: SessionService,
        providers: Arc<ProviderService<C>>,
        workspaces_dir: Option<PathBuf>,
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

    /// Validates the request and assembles its turn: opens the provider's
    /// adapter, reads the session, and opens its directory.
    /// The turn is abortable from here until it is dropped.
    ///
    /// # Errors
    ///
    /// [`AgentError::ContentRequired`] or [`AgentError::ModelRequired`] for
    /// blank content or model, [`AgentError::ProviderNotFound`] when the user
    /// owns no such provider, [`AgentError::Provider`] when opening it
    /// fails, [`AgentError::SessionNotFound`] when the user owns no such
    /// session, [`AgentError::Store`] when the session database fails,
    /// [`AgentError::DirectoryNotFound`] when the session's directory is
    /// gone, and [`AgentError::Workspace`] when the workspace cannot be
    /// created.
    pub async fn prepare(&self, req: TurnRequest) -> Result<Turn<C::Adapter>, AgentError> {
        if req.content.trim().is_empty() {
            return Err(AgentError::ContentRequired);
        }
        if req.model.trim().is_empty() {
            return Err(AgentError::ModelRequired);
        }
        let Some(session) = self.sessions.find(req.user_id, req.session_id).await? else {
            return Err(AgentError::SessionNotFound);
        };
        let previous_api_format = self
            .sessions
            .previous_assistant_api_format(req.user_id, req.session_id)
            .await?;
        let lemma_provider::ProviderBinding {
            adapter,
            api_format,
            tool_calling,
        } = self
            .providers
            .bind(
                req.user_id,
                req.provider_id,
                &req.model,
                previous_api_format,
            )
            .await?;

        let cancel = CancelToken::new();
        let tools = session_tools(
            self.workspaces_dir.as_deref(),
            &session,
            &cancel,
            &self.providers,
            self.web_http.as_ref(),
            req.user_id,
        )
        .await?;
        let system_prompt = tools
            .as_ref()
            .map(|runtime| system_prompt(runtime.env.root()));
        let agent_loop = AgentLoop::new(self.sessions.clone(), adapter, tools);

        let user_message_id = Uuid::new_v4();
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
                api_format,
                tool_calling,
                system_prompt,
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

/// The tools of `session`, rooted in the directory it is bound to or in
/// its workspace under `workspaces_dir`; `None` without a workspaces
/// directory. A running command stops when `cancel` fires.
async fn session_tools<C: Connector, T: HttpTransport + Debug>(
    workspaces_dir: Option<&Path>,
    session: &Session,
    cancel: &CancelToken,
    providers: &ProviderService<C>,
    web_http: Option<&T>,
    user_id: Uuid,
) -> Result<Option<ToolRuntime<LocalExecEnv>>, AgentError> {
    let Some(workspaces_dir) = workspaces_dir else {
        return Ok(None);
    };
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
        web_tools::register_web_tools(&mut registry, providers, transport, user_id).await?;
    }
    Ok(Some(ToolRuntime::new(registry, env)))
}

/// Creates `workspace` when missing and opens an environment over it.
async fn open_workspace(workspace: &Path, cancel: &CancelToken) -> io::Result<LocalExecEnv> {
    fs::create_dir_all(workspace).await?;
    LocalExecEnv::open(workspace, cancel.clone()).await
}

/// Tells the model where its tools run.
fn system_prompt(directory: &Path) -> String {
    format!(
        "Your working directory is {}. The operating system is {}. The bash tool runs \
         commands in {}, starting in the working directory.",
        directory.display(),
        env::consts::OS,
        LocalExecEnv::SHELL,
    )
}
