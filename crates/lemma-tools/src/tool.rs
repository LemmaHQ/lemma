use std::future::Future;
use std::pin::Pin;

use crate::env::ExecEnv;
use crate::error::ToolError;

/// Future returned by tool execution.
pub type BoxToolFuture<'a> =
    Pin<Box<dyn Future<Output = Result<serde_json::Value, ToolError>> + Send + 'a>>;

/// Metadata and JSON schema specification for an advertised tool.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolSpec {
    /// Tool name as presented to the model.
    pub name: String,
    /// Human and model-readable description.
    pub description: String,
    /// JSON schema describing the required and optional parameters.
    pub parameters: serde_json::Value,
}

/// Abstract tool capability runnable by an agent.
pub trait Tool: Send + Sync {
    /// Returns the tool's wire specification.
    fn spec(&self) -> ToolSpec;

    /// Executes the tool with the validated arguments inside the environment.
    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a>;
}
