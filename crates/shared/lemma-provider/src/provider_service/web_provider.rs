use uuid::Uuid;

use crate::web_provider_kind::WebProviderKind;

/// The web operation whose backend fallback order is being selected.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WebFunction {
    /// Web search.
    Search,
    /// URL fetch.
    Fetch,
}

/// A web provider as presented to callers without exposing its API key.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WebProviderView {
    /// Provider id.
    pub id: Uuid,
    /// Backend implementation.
    pub kind: WebProviderKind,
    /// Display name.
    pub name: String,
    /// Whether the backend is selectable.
    pub enabled: bool,
    /// Whether a nonempty API key is stored.
    pub has_key: bool,
    /// Position in the search fallback order.
    pub search_rank: i32,
    /// Position in the fetch fallback order.
    pub fetch_rank: i32,
}

/// Input for updating a web provider's key or enabled flag.
#[derive(Debug, Default)]
pub struct UpdateWebInput {
    /// Plaintext replacement API key; empty clears the key and disables the provider.
    pub api_key: Option<String>,
    /// Enabled flag.
    pub enabled: Option<bool>,
}

/// An enabled web backend with its connection details opened for use.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WebBackend {
    /// Backend implementation.
    pub kind: WebProviderKind,
    /// API base URL; empty for native fetch.
    pub base_url: String,
    /// Plaintext API key; empty for native fetch.
    pub api_key: String,
}
