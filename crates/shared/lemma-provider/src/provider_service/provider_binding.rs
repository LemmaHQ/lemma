use lemma_model::ApiFormat;

/// A provider adapter bound for one turn, with the resolved request behavior.
#[derive(Debug)]
pub struct ProviderBinding<A> {
    /// Adapter connected to the selected endpoint.
    pub adapter: A,
    /// API format the turn uses and records on assistant messages.
    pub api_format: ApiFormat,
    /// Whether the selected model supports tool calling.
    pub tool_calling: bool,
}
