use lemma_core::ToolSpec;
use serde_json::Value;

use crate::tool::{BoxToolFuture, Tool};
use crate::tool_error::ToolError;
use crate::web::WebSearchBackend;

/// Web search that tries each configured backend in order.
#[derive(Debug)]
pub struct WebSearchTool {
    backends: Vec<Box<dyn WebSearchBackend>>,
}

impl WebSearchTool {
    /// Creates a search tool with backends in fallback order.
    ///
    /// # Panics
    ///
    /// Panics when `backends` is empty; the tool is registered only when the
    /// search order has an enabled provider.
    #[must_use]
    pub fn new(backends: Vec<Box<dyn WebSearchBackend>>) -> Self {
        assert!(!backends.is_empty(), "web_search requires a backend");
        Self { backends }
    }
}

impl<E> Tool<E> for WebSearchTool {
    fn spec(&self) -> ToolSpec {
        self.backends[0].spec()
    }

    fn execute<'exec>(&'exec self, args: Value, _env: &'exec E) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            validate_query(&args)?;
            let first = &self.backends[0];
            let mut failures = Vec::new();
            let mut last_error = match first.search(args.clone()).await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    failures.push(format!("{}: {error}", first.name()));
                    error
                }
            };
            for backend in &self.backends[1..] {
                match backend.search(backend.fallback_args(&args)).await {
                    Ok(result) => return Ok(result),
                    Err(error) => {
                        failures.push(format!("{}: {error}", backend.name()));
                        last_error = error;
                    }
                }
            }
            let message = format!("all search backends failed: {}", failures.join("; "));
            match last_error {
                ToolError::Validation(_) => Err(ToolError::Validation(message)),
                ToolError::Execution(_) => Err(ToolError::Execution(message)),
            }
        })
    }
}

fn validate_query(args: &Value) -> Result<(), ToolError> {
    let query = args.get("query").and_then(Value::as_str);
    if query.is_some_and(|query| !query.trim().is_empty()) {
        Ok(())
    } else {
        Err(ToolError::Validation(
            "query must be a nonempty string".to_owned(),
        ))
    }
}
