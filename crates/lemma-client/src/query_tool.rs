use std::sync::Arc;

use lemma_db_client::SqliteTraceStore;
use lemma_tools::{BoxToolFuture, Tool, ToolError, ToolSpec};

/// Tool enabling the agent to search its own past conversation history via FTS5.
pub struct QueryHistoryTool {
    store: Arc<SqliteTraceStore>,
}

impl QueryHistoryTool {
    /// Creates a new query history tool bound to the SQLite store.
    pub fn new(store: Arc<SqliteTraceStore>) -> Self {
        Self { store }
    }
}

impl Tool for QueryHistoryTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "query_history".to_string(),
            description: "Searches past conversation messages using full-text keyword search."
                .to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keywords or search phrase to match against past conversation messages."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of search results to return (default: 5)."
                    }
                },
                "required": ["query"]
            }),
        }
    }

    fn execute<'a>(
        &'a self,
        args: serde_json::Value,
        _env: &'a dyn lemma_tools::ExecEnv,
    ) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let query_str = args.get("query").and_then(|v| v.as_str()).ok_or_else(|| {
                ToolError::Validation("missing required 'query' argument".to_string())
            })?;

            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(5) as usize;

            let matches = self
                .store
                .search_history(query_str, limit)
                .map_err(|e| ToolError::Execution(e.to_string()))?;

            let results: Vec<serde_json::Value> = matches
                .into_iter()
                .map(|(msg_id, conv_id, snippet)| {
                    serde_json::json!({
                        "message_id": msg_id.to_string(),
                        "conversation_id": conv_id.to_string(),
                        "text": snippet,
                    })
                })
                .collect();

            Ok(serde_json::json!({ "results": results }))
        })
    }
}
