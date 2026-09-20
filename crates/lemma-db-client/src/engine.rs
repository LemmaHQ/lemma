use std::path::Path;
use std::sync::Arc;

use lemma_adapter::Provider;
use lemma_agent::AgentLoop;
use lemma_tools::{BashTool, ReadFileTool, ToolRegistry, WriteFileTool};

use crate::error::SqliteStoreError;
use crate::query_tool::QueryHistoryTool;
use crate::store::SqliteTraceStore;
///
/// Designed for direct embedding into the Desktop Electron sidecar or Mobile FFI.
pub struct LocalEngine {
    /// Agent execution loop.
    pub agent: AgentLoop,
    /// Underlying plaintext SQLite store.
    pub store: Arc<SqliteTraceStore>,
    /// Tool registry populated with default built-in tools.
    pub tools: ToolRegistry,
}

impl LocalEngine {
    /// Opens or creates the SQLite database at `db_path` and initializes the engine.
    pub fn open(
        db_path: impl AsRef<Path>,
        provider: Arc<dyn Provider>,
    ) -> Result<Self, SqliteStoreError> {
        let store = Arc::new(SqliteTraceStore::open(db_path)?);
        let agent = AgentLoop::new(store.clone(), provider);
        let mut tools = ToolRegistry::new();
        tools.register(Arc::new(ReadFileTool));
        tools.register(Arc::new(WriteFileTool));
        tools.register(Arc::new(BashTool));
        tools.register(Arc::new(QueryHistoryTool::new(store.clone())));
        Ok(Self {
            agent,
            store,
            tools,
        })
    }
}
