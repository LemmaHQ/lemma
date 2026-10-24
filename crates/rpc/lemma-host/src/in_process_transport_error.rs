use std::error::Error;
use std::fmt;

/// Failures of [`InProcessTransport`](crate::InProcessTransport).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InProcessTransportError {
    /// The method, path, or a header is not valid HTTP.
    InvalidRequest(String),
    /// No open response body has this id.
    UnknownBody(u32),
    /// The response body failed while streaming.
    Body(String),
}

impl fmt::Display for InProcessTransportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRequest(e) => write!(f, "invalid request: {e}"),
            Self::UnknownBody(id) => write!(f, "no open response body {id}"),
            Self::Body(e) => write!(f, "response body: {e}"),
        }
    }
}

impl Error for InProcessTransportError {}
