use serde::{Deserialize, Serialize};

/// Token accounting for one generation, as reported by the provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Usage {
    /// Tokens consumed by the prompt.
    pub input: i64,
    /// Tokens produced in the response.
    pub output: i64,
    /// Prompt tokens served from the provider's cache, when reported.
    pub cache_read: Option<i64>,
    /// Tokens written into the provider's cache, when reported.
    pub cache_write: Option<i64>,
}
