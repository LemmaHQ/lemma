use std::fmt::Debug;

use lemma_core::ToolSpec;
use lemma_tool::{BoxToolFuture, ToolError, WebFetchBackend, WebSearchBackend};
use serde::Deserialize;
use serde_json::{Map, Value, json};

use crate::http_transport::HttpTransport;
use crate::web::post_json::post_json;

/// DeepSeek search and fetch over the DeepSeek tools API.
#[derive(Debug, Clone)]
pub struct DeepSeekWebBackend<T> {
    base_url: String,
    api_key: String,
    transport: T,
}

impl<T: HttpTransport> DeepSeekWebBackend<T> {
    /// Creates a DeepSeek backend with its API base URL and opened key.
    #[must_use]
    pub fn new(mut base_url: String, api_key: String, transport: T) -> Self {
        let trimmed = base_url.trim_end_matches('/').len();
        base_url.truncate(trimmed);
        Self {
            base_url,
            api_key,
            transport,
        }
    }

    fn headers(&self) -> Vec<(String, String)> {
        vec![(
            "authorization".to_owned(),
            format!("Bearer {}", self.api_key),
        )]
    }
}

impl<T: HttpTransport + Debug> WebSearchBackend for DeepSeekWebBackend<T> {
    fn name(&self) -> &'static str {
        "deepseek"
    }

    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "web_search".to_owned(),
            description:
                "Searches the web with DeepSeek and returns titles, URLs, dates, and summaries."
                    .to_owned(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Required nonempty search query."},
                    "count": {"type": "integer", "minimum": 1, "maximum": 50, "description": "Optional result count from 1 to 50; defaults to 10 when omitted."},
                    "ori_question": {"type": "string", "description": "Optional original user question for search context; omitted by default."},
                    "localization": {"type": "string", "description": "Optional localization setting for search; the backend default applies when omitted."},
                    "need_content": {"type": "boolean", "description": "Optional flag to include page content; defaults to false when omitted."}
                },
                "required": ["query"]
            }),
        }
    }

    fn search<'exec>(&'exec self, args: Value) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let response = post_json(
                &self.transport,
                format!("{}/v1/tools/search", self.base_url),
                self.headers(),
                args,
            )
            .await?;
            let response: DeepSeekSearchResponse =
                serde_json::from_value(response).map_err(|error| {
                    ToolError::Execution(format!("bad DeepSeek search response: {error}"))
                })?;
            let results = response
                .results
                .into_iter()
                .map(|result| {
                    json!({
                        "title": result.title,
                        "url": result.url,
                        "date": result.date,
                        "text": result.summary.unwrap_or_default(),
                    })
                })
                .collect::<Vec<_>>();
            Ok(json!({"provider": "deepseek", "results": results}))
        })
    }

    fn fallback_args(&self, args: &Value) -> Value {
        let mut translated = Map::new();
        translated.insert(
            "query".to_owned(),
            args.get("query").cloned().unwrap_or(Value::Null),
        );
        if let Some(count) = args.get("numResults") {
            translated.insert("count".to_owned(), count.clone());
        }
        Value::Object(translated)
    }
}

impl<T: HttpTransport + Debug> WebFetchBackend for DeepSeekWebBackend<T> {
    fn name(&self) -> &'static str {
        "deepseek"
    }

    fn fetch<'exec>(&'exec self, url: String) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let response = post_json(
                &self.transport,
                format!("{}/v1/tools/fetch", self.base_url),
                self.headers(),
                json!({"url": url}),
            )
            .await?;
            let response: DeepSeekFetchResponse =
                serde_json::from_value(response).map_err(|error| {
                    ToolError::Execution(format!("bad DeepSeek fetch response: {error}"))
                })?;
            Ok(json!({
                "provider": "deepseek",
                "url": url,
                "title": response.title,
                "content": response.content,
            }))
        })
    }
}

#[derive(Deserialize)]
struct DeepSeekSearchResponse {
    results: Vec<DeepSeekSearchResult>,
}

#[derive(Deserialize)]
struct DeepSeekSearchResult {
    title: String,
    url: String,
    date: Option<String>,
    summary: Option<String>,
}

#[derive(Deserialize)]
struct DeepSeekFetchResponse {
    title: String,
    content: String,
}
