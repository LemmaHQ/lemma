use std::future::Future;
use std::pin::Pin;

use futures::{Stream, StreamExt};

use crate::error::ProviderError;

/// Raw response body as a byte stream.
pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Vec<u8>, ProviderError>> + Send>>;

type BoxTransportFuture<'a> =
    Pin<Box<dyn Future<Output = Result<ByteStream, ProviderError>> + Send + 'a>>;

/// Pluggable HTTP layer for provider calls.
///
/// Hosts inject their own networking stack (reqwest on server/desktop,
/// platform networking on mobile); adapters never construct clients
/// themselves.
pub trait HttpTransport: Send + Sync {
    /// Sends a POST with a JSON body and returns the response as a byte
    /// stream. Non-2xx statuses become an error carrying the body.
    fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: serde_json::Value,
    ) -> BoxTransportFuture<'_>;
}

/// Default transport backed by reqwest.
pub struct ReqwestTransport {
    client: reqwest::Client,
}

impl ReqwestTransport {
    /// Creates the transport with a fresh client.
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

impl Default for ReqwestTransport {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpTransport for ReqwestTransport {
    fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: serde_json::Value,
    ) -> BoxTransportFuture<'_> {
        Box::pin(async move {
            let mut req = self.client.post(&url).json(&body);
            for (name, value) in headers {
                req = req.header(name, value);
            }
            let resp = req.send().await.map_err(ProviderError::transport)?;
            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.map_err(ProviderError::transport)?;
                return Err(ProviderError::http(status.as_u16(), text));
            }
            Ok(Box::pin(
                resp.bytes_stream()
                    .map(|r| r.map(|b| b.to_vec()).map_err(ProviderError::transport)),
            ) as ByteStream)
        })
    }
}
