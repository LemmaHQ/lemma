use serde::{Deserialize, Serialize};

/// Canonical, provider-agnostic description of a tool offered to a model.
///
/// Adapters translate this into each vendor's tool-definition wire format;
/// the agent loop sources instances from the tool registry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolSpec {
    /// Tool name as presented to the model.
    pub name: String,
    /// Human and model-readable description.
    pub description: String,
    /// JSON schema describing the required and optional parameters.
    pub parameters: serde_json::Value,
}
