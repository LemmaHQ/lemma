use std::fmt::Display;

use lemma_model::ModelError;

pub(crate) fn transport(e: impl Display) -> ModelError {
    ModelError::new(format!("transport: {e}"))
}

pub(crate) fn http(status: u16, body: &str) -> ModelError {
    ModelError::new(format!("upstream {status}: {body}"))
}

pub(crate) fn protocol(msg: String) -> ModelError {
    ModelError::new(msg)
}
