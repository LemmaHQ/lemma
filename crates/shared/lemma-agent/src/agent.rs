use std::path::PathBuf;
use std::sync::Arc;

use dashmap::DashMap;
use lemma_agent_loop::{AgentLoop, CancelToken, ToolRuntime, TurnEnd, TurnEvent, TurnInput};
use lemma_conversation::{ConversationStore, LastModel};
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::{Adapter, Connector};
use lemma_provider::{ProviderService, ProviderStore};
use lemma_tools::{BashTool, LocalExecEnv, ReadFileTool, ToolRegistry, WriteFileTool};
use tokio::fs;
use uuid::Uuid;

use crate::agent_error::AgentError;

/// What a user asks one turn to do.
#[derive(Debug)]
pub struct TurnRequest {
    /// Authenticated caller.
    pub user_id: Uuid,
    /// Conversation the turn continues from its active leaf.
    pub conversation_id: Uuid,
    /// Provider the turn is dispatched to.
    pub provider_id: Uuid,
    /// Model id on that provider.
    pub model: String,
    /// User message text.
    pub content: String,
    /// Reasoning effort; `None` or empty reuses the conversation's last
    /// setting.
    pub thinking_effort: Option<String>,
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
/// With `workspaces_dir` set, each conversation's tools (`read_file`,
/// `write_file`, `bash`) run in `<workspaces_dir>/<conversation id>`;
/// without it, turns call the model without tools.
#[derive(Debug)]
pub struct Agent<S, P, C> {
    store: S,
    providers: Arc<ProviderService<P, C>>,
    workspaces_dir: Option<PathBuf>,
    running: Arc<RunningTurns>,
}

impl<S: ConversationStore, P: ProviderStore, C: Connector> Agent<S, P, C> {
    /// Creates the agent over its store and provider domain.
    pub fn new(
        store: S,
        providers: Arc<ProviderService<P, C>>,
        workspaces_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            store,
            providers,
            workspaces_dir,
            running: Arc::default(),
        }
    }

    /// Validates the request and assembles its turn: opens the provider's
    /// adapter, resolves the thinking effort, and prepares the workspace.
    /// The turn is abortable from here until it is dropped.
    ///
    /// # Errors
    ///
    /// [`AgentError::ContentRequired`] or [`AgentError::ModelRequired`] for
    /// blank content or model, [`AgentError::ProviderNotFound`] when the user
    /// owns no such provider, [`AgentError::Provider`] when opening it
    /// fails, [`AgentError::Store`] when the store fails, and
    /// [`AgentError::Workspace`] when the workspace cannot be created.
    pub async fn prepare(&self, req: TurnRequest) -> Result<Turn<S, C::Adapter>, AgentError> {
        if req.content.trim().is_empty() {
            return Err(AgentError::ContentRequired);
        }
        if req.model.trim().is_empty() {
            return Err(AgentError::ModelRequired);
        }
        let adapter = self.providers.adapter(req.user_id, req.provider_id).await?;
        let thinking_effort = match req.thinking_effort {
            Some(effort) if !effort.is_empty() => Some(effort),
            _ => self
                .store
                .find_by_id_and_user(req.conversation_id, req.user_id)
                .await?
                .and_then(|c| c.last_model)
                .and_then(|m| m.thinking_effort),
        };

        let agent_loop = AgentLoop::new(self.store.clone(), adapter);
        let agent_loop = match &self.workspaces_dir {
            Some(dir) => {
                let workspace = dir.join(req.conversation_id.to_string());
                fs::create_dir_all(&workspace)
                    .await
                    .map_err(|e| AgentError::Workspace(e.to_string()))?;
                let mut registry = ToolRegistry::new();
                registry.register(ReadFileTool);
                registry.register(WriteFileTool);
                registry.register(BashTool);
                agent_loop.with_tools(ToolRuntime::new(registry, LocalExecEnv::new(workspace)))
            }
            None => agent_loop,
        };

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
                conversation_id: req.conversation_id,
                user_message_id,
                user_message: Message::User {
                    content: vec![ContentBlock::Text(TextContent { text: req.content })],
                },
                model: LastModel {
                    provider_id: req.provider_id,
                    model: req.model,
                    thinking_effort,
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
pub struct Turn<S, A> {
    agent_loop: AgentLoop<S, A, LocalExecEnv>,
    input: TurnInput,
    cancel: CancelToken,
    _registration: Registration,
}

impl<S: ConversationStore, A: Adapter> Turn<S, A> {
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
    pub async fn run(
        self,
        observer: impl Fn(TurnEvent) + Send + Sync,
    ) -> Result<TurnEnd, AgentError> {
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
