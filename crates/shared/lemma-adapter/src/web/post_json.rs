use std::time::Duration;

use futures::StreamExt;
use lemma_tool::ToolError;
use serde_json::Value;
use tokio::time::timeout;

use crate::http_transport::HttpTransport;

const POST_TIMEOUT: Duration = Duration::from_secs(60);

pub(crate) async fn post_json<T: HttpTransport>(
    transport: &T,
    url: String,
    headers: Vec<(String, String)>,
    body: Value,
) -> Result<Value, ToolError> {
    timeout(POST_TIMEOUT, async move {
        let mut stream = transport
            .post_stream(url, headers, body)
            .await
            .map_err(|error| ToolError::Execution(error.to_string()))?;
        let mut bytes = Vec::new();
        while let Some(chunk) = stream.next().await {
            bytes.extend(chunk.map_err(|error| ToolError::Execution(error.to_string()))?);
        }
        serde_json::from_slice(&bytes)
            .map_err(|error| ToolError::Execution(format!("bad web response: {error}")))
    })
    .await
    .map_err(|_| ToolError::Execution("web request timed out after 60 seconds".to_owned()))?
}
