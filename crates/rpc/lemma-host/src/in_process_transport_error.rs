use thiserror::Error;

/// Failures of [`InProcessTransport`](crate::InProcessTransport).
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum InProcessTransportError {
    /// The method, path, or a header is not valid HTTP.
    #[error("invalid request: {0}")]
    InvalidRequest(String),
    /// No open response body has this id.
    #[error("no open response body {0}")]
    UnknownBody(u32),
    /// The response body failed while streaming.
    #[error("response body: {0}")]
    Body(String),
}
