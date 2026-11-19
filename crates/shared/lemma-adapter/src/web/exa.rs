use std::fmt::Debug;

use lemma_core::ToolSpec;
use lemma_tool::{BoxToolFuture, ToolError, WebFetchBackend, WebSearchBackend};
use serde::Deserialize;
use serde_json::{Map, Value, json};

use crate::http_transport::HttpTransport;
use crate::web::post_json::post_json;

/// Exa search and fetch over the Exa HTTP API.
#[derive(Debug, Clone)]
pub struct ExaWebBackend<T> {
    base_url: String,
    api_key: String,
    transport: T,
}

impl<T: HttpTransport> ExaWebBackend<T> {
    /// Creates an Exa backend with its API base URL and opened key.
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
        vec![("x-api-key".to_owned(), self.api_key.clone())]
    }
}

impl<T: HttpTransport + Debug> WebSearchBackend for ExaWebBackend<T> {
    fn name(&self) -> &'static str {
        "exa"
    }

    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "web_search".to_owned(),
            description:
                "Searches the web with Exa and returns titles, URLs, dates, and highlights."
                    .to_owned(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Required nonempty search query."},
                    "numResults": {"type": "integer", "minimum": 1, "maximum": 100, "description": "Optional result count from 1 to 100; defaults to 10 when omitted."},
                    "type": {"type": "string", "enum": ["auto", "lite", "deep-lite", "deep"], "description": "Optional search mode: auto (default), lite, deep-lite, or deep."},
                    "includeDomains": {"type": "array", "items": {"type": "string"}, "description": "Optional domains to include; all domains are eligible by default."},
                    "excludeDomains": {"type": "array", "items": {"type": "string"}, "description": "Optional domains to exclude; none are excluded by default."},
                    "startPublishedDate": {"type": "string", "description": "Optional inclusive ISO 8601 publication-date lower bound; no lower bound by default."},
                    "endPublishedDate": {"type": "string", "description": "Optional inclusive ISO 8601 publication-date upper bound; no upper bound by default."},
                    "contents": {
                        "type": "object",
                        "description": "Optional content settings; defaults to highlights enabled when omitted.",
                        "properties": {
                            "highlights": {
                                "oneOf": [{"type": "boolean"}, {"type": "object", "properties": {"query": {"type": "string", "description": "Optional highlight-ranking query; Exa's default applies when omitted."}}}],
                                "description": "Boolean or query object controlling highlights; enabled by default when contents is omitted."
                            }
                        }
                    }
                },
                "required": ["query"]
            }),
        }
    }

    fn search<'exec>(&'exec self, args: Value) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let mut body = args.as_object().cloned().unwrap_or_default();
            body.entry("type").or_insert_with(|| json!("auto"));
            body.entry("contents")
                .or_insert_with(|| json!({"highlights": true}));
            let response = post_json(
                &self.transport,
                format!("{}/search", self.base_url),
                self.headers(),
                Value::Object(body),
            )
            .await?;
            let response: ExaSearchResponse =
                serde_json::from_value(response).map_err(|error| {
                    ToolError::Execution(format!("bad Exa search response: {error}"))
                })?;
            let results = response
                .results
                .into_iter()
                .map(|result| {
                    json!({
                        "title": result.title.unwrap_or_default(),
                        "url": result.url,
                        "date": result.published_date,
                        "text": result.highlights.join("\n"),
                    })
                })
                .collect::<Vec<_>>();
            Ok(json!({"provider": "exa", "results": results}))
        })
    }

    fn fallback_args(&self, args: &Value) -> Value {
        let mut translated = Map::new();
        translated.insert(
            "query".to_owned(),
            args.get("query").cloned().unwrap_or(Value::Null),
        );
        if let Some(count) = args.get("count") {
            translated.insert("numResults".to_owned(), count.clone());
        }
        Value::Object(translated)
    }
}

impl<T: HttpTransport + Debug> WebFetchBackend for ExaWebBackend<T> {
    fn name(&self) -> &'static str {
        "exa"
    }

    fn fetch<'exec>(&'exec self, url: String) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let response = post_json(
                &self.transport,
                format!("{}/contents", self.base_url),
                self.headers(),
                json!({"ids": [url], "text": {}}),
            )
            .await?;
            let response: ExaFetchResponse = serde_json::from_value(response).map_err(|error| {
                ToolError::Execution(format!("bad Exa fetch response: {error}"))
            })?;
            if let Some(status) = response
                .statuses
                .iter()
                .find(|status| status.status != "success")
            {
                return Err(ToolError::Execution(format!(
                    "Exa fetch failed: {}",
                    status.error.clone().unwrap_or_else(|| json!(status.status))
                )));
            }
            let result =
                response.results.into_iter().next().ok_or_else(|| {
                    ToolError::Execution("Exa fetch returned no result".to_owned())
                })?;
            let content = result.text.filter(|text| !text.is_empty()).ok_or_else(|| {
                ToolError::Execution("Exa fetch returned empty content".to_owned())
            })?;
            Ok(json!({
                "provider": "exa",
                "url": result.url.unwrap_or(url),
                "title": result.title.unwrap_or_default(),
                "content": content,
            }))
        })
    }
}

#[derive(Deserialize)]
struct ExaSearchResponse {
    results: Vec<ExaSearchResult>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExaSearchResult {
    title: Option<String>,
    url: String,
    published_date: Option<String>,
    #[serde(default)]
    highlights: Vec<String>,
}

#[derive(Deserialize)]
struct ExaFetchResponse {
    results: Vec<ExaFetchResult>,
    #[serde(default)]
    statuses: Vec<ExaStatus>,
}

#[derive(Deserialize)]
struct ExaFetchResult {
    title: Option<String>,
    url: Option<String>,
    text: Option<String>,
}

#[derive(Deserialize)]
struct ExaStatus {
    status: String,
    error: Option<Value>,
}
