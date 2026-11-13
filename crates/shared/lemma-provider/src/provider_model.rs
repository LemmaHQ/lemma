use serde::{Deserialize, Serialize};

/// One model entry configured on a provider.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderModel {
    /// Model identifier sent to the upstream API.
    pub id: String,
    /// Whether the model supports tool calling.
    pub tool_calling: bool,
}
