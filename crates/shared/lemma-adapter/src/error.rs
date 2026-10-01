/// Any provider failure, reduced to a message. These surface to clients
/// as in-band error events, not coded business errors.
#[derive(Debug)]
pub struct ProviderError {
    /// Human-readable failure description.
    pub message: String,
}

impl ProviderError {
    pub(crate) fn transport(e: impl std::fmt::Display) -> Self {
        Self {
            message: format!("transport: {e}"),
        }
    }

    pub(crate) fn http(status: u16, body: String) -> Self {
        Self {
            message: format!("upstream {status}: {body}"),
        }
    }

    pub(crate) fn protocol(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
        }
    }
}
