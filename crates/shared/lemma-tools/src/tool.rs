use std::pin::Pin;

use crate::approval::ToolTier;
use crate::env::ExecEnv;
use crate::error::ToolError;

pub use lemma_core::ToolSpec;

/// Future returned by tool execution.
pub type BoxToolFuture<'a> =
    Pin<Box<dyn Future<Output = Result<serde_json::Value, ToolError>> + Send + 'a>>;

/// Abstract tool capability runnable by an agent.
pub trait Tool: Send + Sync {
    /// Returns wire specification of the tool.
    fn spec(&self) -> ToolSpec;

    /// Capability tier of the tool.
    fn tier(&self) -> ToolTier;

    /// Executes tool inside environment.
    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a>;
}
