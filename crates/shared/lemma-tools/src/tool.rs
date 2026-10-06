use std::future::Future;
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
    /// Returns the tool's wire specification.
    fn spec(&self) -> ToolSpec;

    /// Capability tier driving default approval behavior.
    fn tier(&self) -> ToolTier;

    /// Executes the tool with the validated arguments inside the environment.
    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a>;
}
