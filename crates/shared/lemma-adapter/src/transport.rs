use std::pin::Pin;
use std::time::Duration;

use futures::{Stream, StreamExt};
use lemma_model::ModelError;

use crate::error;

/// Raw response body as a byte stream.
pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Vec<u8>, ModelError>> + Send>>;

/// Future returned by [`HttpTransport`] calls.
pub type BoxTransportFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, ModelError>> + Send + 'a>>;

/// Time limit of a [`HttpTransport::get_json`] call.
const GET_TIMEOUT: Duration = Duration::from_secs(10);

/// Pluggable HTTP layer for provider calls.
///
/// Hosts inject their own networking stack (reqwest on server/desktop,
/// platform networking on mobile); adapters rely exclusively on injected
/// client implementations.
pub trait HttpTransport: Send + Sync {
    /// Sends a POST with a JSON body and returns the response as a byte
    /// stream. Non-2xx statuses become an error carrying the body.
    fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: serde_json::Value,
    ) -> BoxTransportFuture<'_, ByteStream>;

    /// Sends a GET and parses the response body as JSON, within a 10-second
    /// limit. Non-2xx statuses become an error carrying the body.
    fn get_json(
        &self,
        url: String,
        headers: Vec<(String, String)>,
    ) -> BoxTransportFuture<'_, serde_json::Value>;
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

async fn send(req: reqwest::RequestBuilder) -> Result<reqwest::Response, ModelError> {
    let resp = req.send().await.map_err(error::transport)?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.map_err(error::transport)?;
        return Err(error::http(status.as_u16(), text));
    }
    Ok(resp)
}

fn with_headers(
    mut req: reqwest::RequestBuilder,
    headers: Vec<(String, String)>,
) -> reqwest::RequestBuilder {
    for (name, value) in headers {
        req = req.header(name, value);
    }
    req
}

impl HttpTransport for ReqwestTransport {
    fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: serde_json::Value,
    ) -> BoxTransportFuture<'_, ByteStream> {
        Box::pin(async move {
            let resp = send(with_headers(self.client.post(&url).json(&body), headers)).await?;
            Ok(Box::pin(
                resp.bytes_stream()
                    .map(|r| r.map(|b| b.to_vec()).map_err(error::transport)),
            ) as ByteStream)
        })
    }

    fn get_json(
        &self,
        url: String,
        headers: Vec<(String, String)>,
    ) -> BoxTransportFuture<'_, serde_json::Value> {
        Box::pin(async move {
            let req = with_headers(self.client.get(&url).timeout(GET_TIMEOUT), headers);
            send(req).await?.json().await.map_err(error::transport)
        })
    }
}
