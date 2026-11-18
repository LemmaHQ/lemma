use std::path::Path;

use tokio::sync::Mutex;

use crate::engine::Engine;
use crate::engine_open_error::EngineOpenError;
use crate::in_process_transport::{InProcessTransport, ResponseHead};
use crate::in_process_transport_error::InProcessTransportError;

/// Owns an [`Engine`] and an [`InProcessTransport`] for hosts that call the
/// Connect router in process without a network listener.
#[derive(Debug)]
pub struct InProcessEngine {
    transport: InProcessTransport,
    engine: Mutex<Option<Engine>>,
}

impl InProcessEngine {
    /// Opens the engine over `data_dir` and wraps its router in an
    /// in-process transport.
    ///
    /// # Errors
    ///
    /// [`EngineOpenError`] naming the startup step that failed.
    pub async fn open(data_dir: &Path) -> Result<Self, EngineOpenError> {
        let engine = Engine::open(data_dir).await?;
        Ok(Self {
            transport: InProcessTransport::new(engine.router()),
            engine: Mutex::new(Some(engine)),
        })
    }

    /// Sends one request through the router and opens its response body.
    ///
    /// # Errors
    ///
    /// [`InProcessTransportError::InvalidRequest`] when the method, path, or
    /// a header is not valid HTTP.
    pub async fn request(
        &self,
        method: &str,
        path: &str,
        headers: &[(String, String)],
        body: Vec<u8>,
    ) -> Result<ResponseHead, InProcessTransportError> {
        self.transport.request(method, path, headers, body).await
    }

    /// Reads the next chunk of an open response body; `None` marks its end
    /// and closes it.
    ///
    /// # Errors
    ///
    /// [`InProcessTransportError::UnknownBody`] when `body` is not open;
    /// [`InProcessTransportError::Body`] when the body fails, which also
    /// closes it.
    pub async fn read(&self, body: u32) -> Result<Option<Vec<u8>>, InProcessTransportError> {
        self.transport
            .read(body)
            .await
            .map(|chunk| chunk.map(Vec::from))
    }

    /// Closes an open response body before its end; an unknown id is
    /// ignored.
    pub fn cancel(&self, body: u32) {
        self.transport.cancel(body);
    }

    /// Closes the engine's database; safe to call more than once.
    pub async fn close(&self) {
        if let Some(engine) = self.engine.lock().await.take() {
            engine.close().await;
        }
    }
}
