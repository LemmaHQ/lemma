use std::fmt::Debug;
use std::pin::Pin;

use lemma_core::ToolSpec;
use serde_json::Value;

use crate::tool_error::ToolError;

/// Future returned by tool execution.
pub type BoxToolFuture<'exec> =
    Pin<Box<dyn Future<Output = Result<Value, ToolError>> + Send + 'exec>>;

/// Capability tier of a tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolTier {
    /// Read-only inspection.
    Read,
    /// State-mutating operation.
    Write,
    /// Command execution.
    Exec,
}

/// Abstract tool capability runnable by an agent inside an `E`
/// environment.
pub trait Tool<E>: Debug + Send + Sync {
    /// Returns wire specification of the tool.
    fn spec(&self) -> ToolSpec;

    /// Capability tier of the tool.
    fn tier(&self) -> ToolTier;

    /// Executes the tool inside `env`. The future fails with
    /// [`ToolError::Validation`] for arguments that do not match the
    /// tool's parameters and with the environment's error otherwise.
    fn execute<'exec>(&'exec self, args: Value, env: &'exec E) -> BoxToolFuture<'exec>;
}
