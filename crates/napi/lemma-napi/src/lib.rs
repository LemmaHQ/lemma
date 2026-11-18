//! Node-API addon that runs the engine inside the Electron engine
//! process: it opens the engine over a data directory and serves its
//! Connect router through an in-process transport.

use std::path::Path;

use lemma_engine::InProcessEngine;
use napi::bindgen_prelude::Buffer;
use napi::{Error, Result};
use napi_derive::napi;

/// One HTTP header.
#[napi(object)]
#[derive(Debug)]
pub struct Header {
    /// Header name.
    pub name: String,
    /// Header value.
    pub value: String,
}

/// Status and headers of a response; its body is read by
/// [`Engine::read`] under `body`.
#[napi(object)]
#[derive(Debug)]
pub struct ResponseHead {
    /// Id of the open response body.
    pub body: u32,
    /// HTTP status code.
    pub status: u32,
    /// Response headers, in response order.
    pub headers: Vec<Header>,
}

/// The open engine.
#[napi]
#[derive(Debug)]
pub struct Engine {
    engine: InProcessEngine,
}

/// Opens the engine over `data_dir`.
///
/// # Errors
///
/// The startup step that failed, from [`InProcessEngine::open`].
#[napi]
pub async fn open(data_dir: String) -> Result<Engine> {
    InProcessEngine::open(Path::new(&data_dir))
        .await
        .map(|engine| Engine { engine })
        .map_err(|e| Error::from_reason(e.to_string()))
}

#[napi]
impl Engine {
    /// Sends one request to the engine and opens its response body.
    ///
    /// # Errors
    ///
    /// An invalid method, path, or header.
    #[napi]
    pub async fn request(
        &self,
        method: String,
        path: String,
        headers: Vec<Header>,
        body: Buffer,
    ) -> Result<ResponseHead> {
        let headers: Vec<(String, String)> = headers
            .into_iter()
            .map(|header| (header.name, header.value))
            .collect();
        let head = self
            .engine
            .request(&method, &path, &headers, body.to_vec())
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;
        Ok(ResponseHead {
            body: head.body,
            status: u32::from(head.status),
            headers: head
                .headers
                .into_iter()
                .map(|(name, value)| Header { name, value })
                .collect(),
        })
    }

    /// Reads the next chunk of a response body; `null` marks its end.
    ///
    /// # Errors
    ///
    /// An unknown body id, or a body that failed while streaming.
    #[napi]
    pub async fn read(&self, body: u32) -> Result<Option<Buffer>> {
        self.engine
            .read(body)
            .await
            .map(|chunk| chunk.map(Buffer::from))
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    /// Closes a response body before its end.
    #[napi]
    pub fn cancel(&self, body: u32) {
        self.engine.cancel(body);
    }

    /// Closes the engine's database; call it once no request is in flight.
    #[napi]
    pub async fn close(&self) {
        self.engine.close().await;
    }
}
