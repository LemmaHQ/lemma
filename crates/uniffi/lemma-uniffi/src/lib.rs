//! UniFFI facade for Android: opens the engine over a data directory and
//! serves its Connect router through an in-process transport.

mod platform_verifier;

use std::path::Path;

use lemma_engine::InProcessEngine;
use thiserror::Error;

uniffi::setup_scaffolding!();

/// Failures of the engine facade.
#[derive(Debug, Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum EngineError {
    /// A startup step of [`LemmaEngine::open`] failed.
    #[error("{0}")]
    Open(String),
    /// A request was malformed, or its response body is not open or failed
    /// while streaming.
    #[error("{0}")]
    Transport(String),
}

/// One HTTP header.
#[derive(Debug, uniffi::Record)]
pub struct Header {
    /// Header name.
    pub name: String,
    /// Header value.
    pub value: String,
}

/// Status and headers of a response; its body is read by
/// [`LemmaEngine::read`] under `body`.
#[derive(Debug, uniffi::Record)]
pub struct ResponseHead {
    /// Id of the open response body.
    pub body: u32,
    /// HTTP status code.
    pub status: u16,
    /// Response headers, in response order.
    pub headers: Vec<Header>,
}

/// The open engine.
#[derive(Debug, uniffi::Object)]
pub struct LemmaEngine {
    engine: InProcessEngine,
}

#[uniffi::export(async_runtime = "tokio")]
impl LemmaEngine {
    /// Opens the engine over `data_dir`.
    ///
    /// # Errors
    ///
    /// [`EngineError::Open`] naming the startup step that failed.
    #[uniffi::constructor]
    pub async fn open(data_dir: String) -> Result<Self, EngineError> {
        InProcessEngine::open(Path::new(&data_dir))
            .await
            .map(|engine| Self { engine })
            .map_err(|e| EngineError::Open(e.to_string()))
    }

    /// Sends one request to the engine and opens its response body.
    ///
    /// # Errors
    ///
    /// [`EngineError::Transport`] for an invalid method, path, or header.
    pub async fn request(
        &self,
        method: String,
        path: String,
        headers: Vec<Header>,
        body: Vec<u8>,
    ) -> Result<ResponseHead, EngineError> {
        let headers: Vec<(String, String)> = headers
            .into_iter()
            .map(|header| (header.name, header.value))
            .collect();
        let head = self
            .engine
            .request(&method, &path, &headers, body)
            .await
            .map_err(|e| EngineError::Transport(e.to_string()))?;
        Ok(ResponseHead {
            body: head.body,
            status: head.status,
            headers: head
                .headers
                .into_iter()
                .map(|(name, value)| Header { name, value })
                .collect(),
        })
    }

    /// Reads the next chunk of a response body; `None` marks its end.
    ///
    /// # Errors
    ///
    /// [`EngineError::Transport`] for an unknown body id, or a body that
    /// failed while streaming.
    pub async fn read(&self, body: u32) -> Result<Option<Vec<u8>>, EngineError> {
        self.engine
            .read(body)
            .await
            .map_err(|e| EngineError::Transport(e.to_string()))
    }

    /// Closes a response body before its end.
    pub fn cancel(&self, body: u32) {
        self.engine.cancel(body);
    }

    /// Closes the engine's database; call it once no request is in flight.
    /// Requests after it fail, and a second call does nothing.
    pub async fn shutdown(&self) {
        self.engine.close().await;
    }
}
