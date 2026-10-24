//! UniFFI facade for Android local mode: opens the local engine over a data
//! directory and serves its Connect router through an in-process transport.

use std::error::Error;
use std::fmt;
use std::path::Path;

use lemma_host::{InProcessTransport, LocalEngine};
use tokio::sync::Mutex;

uniffi::setup_scaffolding!();

/// Failures of the engine facade.
#[derive(Debug, uniffi::Error)]
#[uniffi(flat_error)]
pub enum EngineError {
    /// A startup step of [`LemmaEngine::open`] failed.
    Open(String),
    /// A request was malformed, or its response body is not open or failed
    /// while streaming.
    Transport(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Open(e) | Self::Transport(e) => write!(f, "{e}"),
        }
    }
}

impl Error for EngineError {}

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

/// The open local engine.
#[derive(Debug, uniffi::Object)]
pub struct LemmaEngine {
    transport: InProcessTransport,
    local: Mutex<Option<LocalEngine>>,
}

#[uniffi::export(async_runtime = "tokio")]
impl LemmaEngine {
    /// Opens the local engine over `data_dir`.
    ///
    /// # Errors
    ///
    /// [`EngineError::Open`] naming the startup step that failed.
    #[uniffi::constructor]
    pub async fn open(data_dir: String) -> Result<Self, EngineError> {
        let local = LocalEngine::open(Path::new(&data_dir))
            .await
            .map_err(|e| EngineError::Open(e.to_string()))?;
        Ok(Self {
            transport: InProcessTransport::new(local.router()),
            local: Mutex::new(Some(local)),
        })
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
            .transport
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
        self.transport
            .read(body)
            .await
            .map(|chunk| chunk.map(Vec::from))
            .map_err(|e| EngineError::Transport(e.to_string()))
    }

    /// Closes a response body before its end.
    pub fn cancel(&self, body: u32) {
        self.transport.cancel(body);
    }

    /// Closes the engine's database; call it once no request is in flight.
    /// Named apart from `close`, which the Kotlin binding takes from
    /// `AutoCloseable` to free the native object.
    pub async fn shutdown(&self) {
        if let Some(local) = self.local.lock().await.take() {
            local.close().await;
        }
    }
}
