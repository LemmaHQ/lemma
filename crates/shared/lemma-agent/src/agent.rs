use std::path::PathBuf;
use std::sync::Arc;

use lemma_agent_loop::{AgentConfig, AgentLoop, ToolRuntime, TurnEvent, TurnInput};
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::Connector;
use lemma_provider::ProviderService;
use lemma_session::TraceStore;
use lemma_tools::{BashTool, LocalExecEnv, ReadFileTool, ToolRegistry, WriteFileTool};
use uuid::Uuid;

use crate::error::AgentError;

/// Opens the trace store scoped to one user.
pub type TraceStoreFactory = Arc<dyn Fn(Uuid) -> Arc<dyn TraceStore> + Send + Sync>;

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

/// Assembles and runs turns.
///
/// With `workspaces_dir` set, each conversation's tools (`read_file`,
/// `write_file`, `bash`) run in `<workspaces_dir>/<conversation id>`;
/// without it, turns call the model without tools.
pub struct Agent {
    traces: TraceStoreFactory,
    providers: Arc<ProviderService>,
    connector: Arc<dyn Connector>,
    workspaces_dir: Option<PathBuf>,
}

impl Agent {
    /// Creates the agent over its stores, provider domain, and connector.
    pub fn new(
        traces: TraceStoreFactory,
        providers: Arc<ProviderService>,
        connector: Arc<dyn Connector>,
        workspaces_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            traces,
            providers,
            connector,
            workspaces_dir,
        }
    }

    /// Validates the request and assembles its turn: opens the provider's
    /// endpoint, resolves the thinking effort, and prepares the workspace.
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
        let traces = (self.traces)(req.user_id);
        let thinking_effort = match req.thinking_effort {
            Some(effort) if !effort.is_empty() => Some(effort),
            _ => traces
                .get_conversation(req.conversation_id)
                .await?
                .and_then(|meta| meta.last_model)
                .and_then(|m| m.thinking_effort),
        };

        let agent_loop = AgentLoop::new(traces, self.connector.connect(endpoint));
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

        Ok(Turn {
            agent_loop,
            input: TurnInput {
                conversation_id: req.conversation_id,
                user_message_id: Uuid::new_v4(),
                user_message: Message::User {
                    content: vec![ContentBlock::Text(TextContent { text: req.content })],
                },
                config: AgentConfig {
                    model: req.model,
                    provider_id: req.provider_id,
                    thinking_effort,
                },
            },
        })
    }
}

/// One assembled turn, ready to run.
pub struct Turn {
    agent_loop: AgentLoop,
    input: TurnInput,
}

impl Turn {
    /// Runs the turn to its end, reporting progress to `observer`.
    pub async fn run(self, observer: impl Fn(TurnEvent) + Send + Sync) -> Result<(), AgentError> {
        Ok(self.agent_loop.run_turn(self.input, &observer).await?)
    }
}
