use std::path::PathBuf;
use std::sync::Arc;

use dashmap::DashMap;
use lemma_agent_loop::{
    AgentConfig, AgentLoop, CancelToken, ToolRuntime, TurnEnd, TurnEvent, TurnInput,
};
use lemma_conversation::ConversationStore;
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::Connector;
use lemma_provider::ProviderService;
use lemma_tools::{BashTool, LocalExecEnv, ReadFileTool, ToolRegistry, WriteFileTool};
use uuid::Uuid;

use crate::error::AgentError;

/// What a user asks one turn to do.
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

/// Running turns by user message id, with the user that owns each.
type RunningTurns = DashMap<Uuid, (Uuid, CancelToken)>;

/// Assembles and runs turns, and aborts the ones still running.
///
/// With `workspaces_dir` set, each conversation's tools (`read_file`,
/// `write_file`, `bash`) run in `<workspaces_dir>/<conversation id>`;
/// without it, turns call the model without tools.
pub struct Agent {
    store: Arc<dyn ConversationStore>,
    providers: Arc<ProviderService>,
    connector: Arc<dyn Connector>,
    workspaces_dir: Option<PathBuf>,
    running: Arc<RunningTurns>,
}

impl Agent {
    /// Creates the agent over its store, provider domain, and connector.
    pub fn new(
        store: Arc<dyn ConversationStore>,
        providers: Arc<ProviderService>,
        connector: Arc<dyn Connector>,
        workspaces_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            store,
            providers,
            connector,
            workspaces_dir,
            running: Arc::default(),
        }
    }

    /// Validates the request and assembles its turn: opens the provider's
    /// endpoint, resolves the thinking effort, and prepares the workspace.
    /// The turn is abortable from here until it is dropped.
    pub async fn prepare(&self, req: TurnRequest) -> Result<Turn, AgentError> {
        if req.content.trim().is_empty() {
            return Err(AgentError::ContentRequired);
        }
        if req.model.trim().is_empty() {
            return Err(AgentError::ModelRequired);
        }
        let endpoint = self
            .providers
            .endpoint(req.user_id, req.provider_id)
            .await?;
        let thinking_effort = match req.thinking_effort {
            Some(effort) if !effort.is_empty() => Some(effort),
            _ => self
                .store
                .find_by_id_and_user(req.conversation_id, req.user_id)
                .await?
                .and_then(|c| c.last_model)
                .and_then(|m| m.thinking_effort),
        };

        let agent_loop = AgentLoop::new(Arc::clone(&self.store), self.connector.connect(endpoint));
        let agent_loop = match &self.workspaces_dir {
            Some(dir) => {
                let workspace = dir.join(req.conversation_id.to_string());
                tokio::fs::create_dir_all(&workspace)
                    .await
                    .map_err(|e| AgentError::Workspace(e.to_string()))?;
                let mut registry = ToolRegistry::new();
                registry.register(Arc::new(ReadFileTool));
                registry.register(Arc::new(WriteFileTool));
                registry.register(Arc::new(BashTool));
                agent_loop.with_tools(ToolRuntime::new(
                    registry,
                    Arc::new(LocalExecEnv::new(workspace)),
                ))
            }
            None => agent_loop,
        };

        let user_message_id = Uuid::new_v4();
        let cancel = CancelToken::new();
        self.running
            .insert(user_message_id, (req.user_id, cancel.clone()));
        Ok(Turn {
            agent_loop,
            input: TurnInput {
                user_id: req.user_id,
                conversation_id: req.conversation_id,
                user_message_id,
                user_message: Message::User {
                    content: vec![ContentBlock::Text(TextContent { text: req.content })],
                },
                config: AgentConfig {
                    model: req.model,
                    provider_id: req.provider_id,
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
        if let Some(entry) = self.running.get(&user_message_id)
            && entry.0 == user_id
        {
            entry.1.cancel();
        }
    }
}

/// One assembled turn, ready to run.
pub struct Turn {
    agent_loop: AgentLoop,
    input: TurnInput,
    cancel: CancelToken,
    _registration: Registration,
}

impl Turn {
    /// The id of the user message this turn appends; abort and resume
    /// address the turn by it.
    pub fn user_message_id(&self) -> Uuid {
        self.input.user_message_id
    }

    /// Runs the turn to its end, reporting progress to `observer`.
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
struct Registration {
    running: Arc<RunningTurns>,
    user_message_id: Uuid,
}

impl Drop for Registration {
    fn drop(&mut self) {
        self.running.remove(&self.user_message_id);
    }
}
