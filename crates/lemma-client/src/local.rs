use std::path::Path;
use std::sync::Arc;

use lemma_adapter::Provider;
use lemma_agent::{AgentConfig, AgentLoop, TurnEvent};
use lemma_core::Message;
use lemma_db_client::SqliteTraceStore;
use lemma_session::{ConversationMeta, StoredMessage, TraceStore};
use lemma_tools::{BashTool, ReadFileTool, ToolRegistry, WriteFileTool};
use uuid::Uuid;

use crate::engine::{BoxClientFuture, ClientEngine, EngineMode};
use crate::error::ClientError;

/// Local mode client engine, backed by on-device plaintext SQLite.
pub struct LocalClientEngine {
    agent: AgentLoop,
    store: Arc<SqliteTraceStore>,
    tools: ToolRegistry,
}

impl LocalClientEngine {
    /// Opens or creates the SQLite database at `db_path` and initializes the local engine.
    pub fn open(
        db_path: impl AsRef<Path>,
        provider: Arc<dyn Provider>,
    ) -> Result<Self, ClientError> {
        let store = Arc::new(SqliteTraceStore::open(db_path)?);
        let agent = AgentLoop::new(store.clone(), provider);

        let mut tools = ToolRegistry::new();
        tools.register(Arc::new(ReadFileTool));
        tools.register(Arc::new(WriteFileTool));
        tools.register(Arc::new(BashTool));
        tools.register(Arc::new(crate::query_tool::QueryHistoryTool::new(
            store.clone(),
        )));

        Ok(Self {
            agent,
            store,
            tools,
        })
    }

    /// Access to the underlying SQLite store (e.g. for full-text search).
    pub fn store(&self) -> &Arc<SqliteTraceStore> {
        &self.store
    }

    /// Access to the tool registry.
    pub fn tools(&self) -> &ToolRegistry {
        &self.tools
    }
}

impl ClientEngine for LocalClientEngine {
    fn mode(&self) -> EngineMode {
        EngineMode::Local
    }

    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
    ) -> BoxClientFuture<'a, ConversationMeta> {
        Box::pin(async move {
            self.store
                .create_conversation(id, title, true)
                .await
                .map_err(ClientError::from)
        })
    }

    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxClientFuture<'a, Option<ConversationMeta>> {
        Box::pin(async move {
            self.store
                .get_conversation(id)
                .await
                .map_err(ClientError::from)
        })
    }

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxClientFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
            self.store
                .list_messages(conversation_id)
                .await
                .map_err(ClientError::from)
        })
    }

    fn run_turn<'a>(
        &'a self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
        observer: Option<Arc<dyn Fn(TurnEvent) + Send + Sync>>,
    ) -> BoxClientFuture<'a, (Uuid, String)> {
        Box::pin(async move {
            self.agent
                .run_turn_observed(
                    conversation_id,
                    user_message,
                    parent_id_override,
                    config,
                    observer,
                )
                .await
                .map_err(ClientError::from)
        })
    }
}
