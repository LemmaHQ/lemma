use std::pin::Pin;
use std::time::Duration;

use futures::Stream;
use lemma_model::ModelError;
use reqwest::{Client, RequestBuilder, Response};
use serde_json::Value;

use crate::error;

/// Raw response body as a byte stream.
pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Vec<u8>, ModelError>> + Send>>;

/// Time limit of a [`HttpTransport::get_json`] call.
const GET_TIMEOUT: Duration = Duration::from_secs(10);

/// Pluggable HTTP layer for provider calls.
///
/// Hosts inject their own networking stack (reqwest on server/desktop,
/// platform networking on mobile); adapters rely exclusively on injected
/// client implementations. Clones share one underlying client.
pub trait HttpTransport: Clone + Send + Sync + 'static {
    /// Sends a POST with a JSON body and returns the response as a byte
    /// stream.
    ///
    /// # Errors
    ///
    /// [`ModelError`] when the request fails or the status is not 2xx; the
    /// error carries the response body.
    fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: Value,
    ) -> impl Future<Output = Result<ByteStream, ModelError>> + Send;

    /// Sends a GET and parses the response body as JSON, within a 10-second
    /// limit.
    ///
    /// # Errors
    ///
    /// [`ModelError`] when the request fails or times out, the status is not
    /// 2xx, or the body is not JSON.
    fn get_json(
        &self,
        url: String,
        headers: Vec<(String, String)>,
    ) -> impl Future<Output = Result<Value, ModelError>> + Send;
}

/// Default transport backed by reqwest.
#[derive(Debug, Clone, Default)]
pub struct ReqwestTransport {
    client: Client,
}

impl ReqwestTransport {
    /// Creates the transport with a fresh client.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}

async fn send(req: RequestBuilder) -> Result<Response, ModelError> {
    let resp = req.send().await.map_err(error::transport)?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.map_err(error::transport)?;
        return Err(error::http(status.as_u16(), &text));
    }
    Ok(resp)
}

fn with_headers(mut req: RequestBuilder, headers: Vec<(String, String)>) -> RequestBuilder {
    for (name, value) in headers {
        req = req.header(name, value);
    }
    req
}

impl HttpTransport for ReqwestTransport {
    async fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: Value,
    ) -> Result<ByteStream, ModelError> {
        use futures::StreamExt;

        let resp = send(with_headers(self.client.post(&url).json(&body), headers)).await?;
        let stream: ByteStream = Box::pin(
            resp.bytes_stream()
                .map(|r| r.map(|b| b.to_vec()).map_err(error::transport)),
        );
        Ok(stream)
    }

    async fn get_json(
        &self,
        url: String,
        headers: Vec<(String, String)>,
    ) -> Result<Value, ModelError> {
        let req = with_headers(self.client.get(&url).timeout(GET_TIMEOUT), headers);
        send(req).await?.json().await.map_err(error::transport)
    }
}
