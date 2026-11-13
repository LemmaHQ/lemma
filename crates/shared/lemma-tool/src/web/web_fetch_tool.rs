use lemma_core::ToolSpec;
use serde_json::{Value, json};

use crate::tool::{BoxToolFuture, Tool};
use crate::tool_error::ToolError;
use crate::web::WebFetchBackend;

/// Web page fetching that tries each configured backend in order.
#[derive(Debug)]
pub struct WebFetchTool {
    backends: Vec<Box<dyn WebFetchBackend>>,
}

impl WebFetchTool {
    /// Creates a fetch tool with backends in fallback order.
    ///
    /// # Panics
    ///
    /// Panics when `backends` is empty; the tool is registered only when the
    /// fetch order has an enabled provider.
    #[must_use]
    pub fn new(backends: Vec<Box<dyn WebFetchBackend>>) -> Self {
        assert!(!backends.is_empty(), "web_fetch requires a backend");
        Self { backends }
    }
}

impl<E> Tool<E> for WebFetchTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "web_fetch".to_owned(),
            description: "Fetches a web page and returns its title and textual content.".to_owned(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The nonempty absolute URL of the page to fetch."
                    }
                },
                "required": ["url"]
            }),
        }
    }

    fn execute<'exec>(&'exec self, args: Value, _env: &'exec E) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let url = args
                .get("url")
                .and_then(Value::as_str)
                .filter(|url| !url.trim().is_empty())
                .ok_or_else(|| ToolError::Validation("url must be a nonempty string".to_owned()))?;
            let first = &self.backends[0];
            let mut last_error = match first.fetch(url.to_owned()).await {
                Ok(result) => return Ok(result),
                Err(error) => error,
            };
            for backend in &self.backends[1..] {
                match backend.fetch(url.to_owned()).await {
                    Ok(result) => return Ok(result),
                    Err(error) => last_error = error,
                }
            }
            Err(last_error)
        })
    }
}
