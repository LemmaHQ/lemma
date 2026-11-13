use std::fmt::Debug;

use lemma_core::ToolSpec;
use serde_json::Value;

use crate::tool::BoxToolFuture;

/// One provider capable of executing a web search.
pub trait WebSearchBackend: Debug + Send + Sync {
    /// Returns the provider name included in normalized results.
    fn name(&self) -> &'static str;

    /// Returns the provider-specific `web_search` tool specification.
    fn spec(&self) -> ToolSpec;

    /// Executes a search and returns normalized result JSON.
    fn search<'exec>(&'exec self, args: Value) -> BoxToolFuture<'exec>;

    /// Translates only the query and result count from the primary arguments.
    fn fallback_args(&self, args: &Value) -> Value;
}
