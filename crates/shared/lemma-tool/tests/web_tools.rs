//! Ordered fallback, argument translation, and validation for web tools.

use std::error::Error;
use std::sync::{Arc, Mutex, PoisonError};

use lemma_tool::{
    BoxToolFuture, Tool, ToolError, ToolSpec, WebFetchBackend, WebFetchTool, WebSearchBackend,
    WebSearchTool,
};
use serde_json::{Value, json};

#[derive(Debug)]
struct SearchStub {
    name: &'static str,
    description: &'static str,
    fail: bool,
    validation: bool,
    calls: Arc<Mutex<Vec<Value>>>,
}

impl SearchStub {
    fn new(name: &'static str, fail: bool, calls: Arc<Mutex<Vec<Value>>>) -> Self {
        Self {
            name,
            description: "primary search schema",
            fail,
            validation: false,
            calls,
        }
    }

    fn failing_validation(name: &'static str, calls: Arc<Mutex<Vec<Value>>>) -> Self {
        Self {
            name,
            description: "fallback search schema",
            fail: true,
            validation: true,
            calls,
        }
    }
}

impl WebSearchBackend for SearchStub {
    fn name(&self) -> &'static str {
        self.name
    }

    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "web_search".to_owned(),
            description: self.description.to_owned(),
            parameters: json!({"type": "object", "provider": self.name}),
        }
    }

    fn search<'exec>(&'exec self, args: Value) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            self.calls
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .push(args);
            if self.fail && self.validation {
                Err(ToolError::Validation(format!(
                    "{} rejected arguments",
                    self.name
                )))
            } else if self.fail {
                Err(ToolError::Execution(format!("{} unavailable", self.name)))
            } else {
                Ok(json!({"provider": self.name, "results": []}))
            }
        })
    }

    fn fallback_args(&self, args: &Value) -> Value {
        let mut translated = json!({"query": args["query"]});
        if let Some(count) = args.get("count").or_else(|| args.get("numResults")) {
            let key = if self.name == "exa" {
                "numResults"
            } else {
                "count"
            };
            translated[key] = count.clone();
        }
        translated
    }
}

#[derive(Debug)]
struct FetchStub {
    name: &'static str,
    fail: bool,
    calls: Arc<Mutex<Vec<String>>>,
}

impl WebFetchBackend for FetchStub {
    fn name(&self) -> &'static str {
        self.name
    }

    fn fetch<'exec>(&'exec self, url: String) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            self.calls
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .push(url.clone());
            if self.fail {
                Err(ToolError::Execution(format!("{} unavailable", self.name)))
            } else {
                Ok(json!({"provider": self.name, "url": url, "title": "", "content": "ok"}))
            }
        })
    }
}

#[tokio::test]
async fn search_uses_the_primary_spec_and_translates_fallback_arguments()
-> Result<(), Box<dyn Error>> {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let tool = WebSearchTool::new(vec![
        Box::new(SearchStub::new("deepseek", true, Arc::clone(&calls))),
        Box::new(SearchStub::new("exa", false, Arc::clone(&calls))),
    ]);
    assert_eq!(Tool::<()>::spec(&tool).description, "primary search schema");
    assert_eq!(Tool::<()>::spec(&tool).parameters["provider"], "deepseek");

    let result = tool
        .execute(
            json!({"query": "lemma", "count": 3, "need_content": true}),
            &(),
        )
        .await?;

    assert_eq!(result["provider"], "exa");
    assert_eq!(
        *calls.lock().unwrap_or_else(PoisonError::into_inner),
        [
            json!({"query": "lemma", "count": 3, "need_content": true}),
            json!({"query": "lemma", "numResults": 3}),
        ]
    );
    Ok(())
}

#[tokio::test]
async fn search_reports_every_failed_backend_with_the_last_error_kind() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let tool = WebSearchTool::new(vec![
        Box::new(SearchStub::new("deepseek", true, Arc::clone(&calls))),
        Box::new(SearchStub::new("exa", true, calls)),
    ]);

    let error = tool
        .execute(json!({"query": "lemma", "count": 2}), &())
        .await
        .err()
        .unwrap_or_else(|| panic!("both backends fail"));

    assert!(matches!(error, ToolError::Execution(_)));
    let message = error.to_string();
    assert!(message.contains("deepseek unavailable"), "{message}");
    assert!(message.contains("exa unavailable"), "{message}");

    let calls = Arc::new(Mutex::new(Vec::new()));
    let tool = WebSearchTool::new(vec![
        Box::new(SearchStub::new("exa", true, Arc::clone(&calls))),
        Box::new(SearchStub::failing_validation("deepseek", calls)),
    ]);
    let error = tool
        .execute(json!({"query": "lemma", "numResults": 2}), &())
        .await
        .err()
        .unwrap_or_else(|| panic!("both backends fail"));
    assert!(matches!(error, ToolError::Validation(_)));
    let message = error.to_string();
    assert!(message.contains("exa unavailable"), "{message}");
    assert!(message.contains("deepseek rejected arguments"), "{message}");
}

#[tokio::test]
async fn search_rejects_bad_arguments() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let tool = WebSearchTool::new(vec![Box::new(SearchStub::new("exa", false, calls))]);
    for args in [json!({}), json!({"query": " "}), json!({"query": 4})] {
        let error = tool
            .execute(args, &())
            .await
            .err()
            .unwrap_or_else(|| panic!("invalid query must fail"));
        assert!(matches!(error, ToolError::Validation(_)));
    }
    let result = tool
        .execute(json!({"query": "lemma"}), &())
        .await
        .unwrap_or_else(|error| panic!("primary search failed: {error}"));
    assert_eq!(result["provider"], "exa");
}

#[test]
#[should_panic(expected = "web_search requires a backend")]
fn search_cannot_be_constructed_without_a_backend() {
    let _ = WebSearchTool::new(vec![]);
}

#[tokio::test]
async fn fetch_falls_back_only_after_an_error() -> Result<(), Box<dyn Error>> {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let tool = WebFetchTool::new(vec![
        Box::new(FetchStub {
            name: "exa",
            fail: true,
            calls: Arc::clone(&calls),
        }),
        Box::new(FetchStub {
            name: "native",
            fail: false,
            calls: Arc::clone(&calls),
        }),
    ]);
    assert_eq!(Tool::<()>::spec(&tool).name, "web_fetch");

    let result = tool
        .execute(json!({"url": "https://example.com"}), &())
        .await?;

    assert_eq!(result["provider"], "native");
    assert_eq!(
        *calls.lock().unwrap_or_else(PoisonError::into_inner),
        ["https://example.com", "https://example.com"]
    );

    let primary = WebFetchTool::new(vec![Box::new(FetchStub {
        name: "exa",
        fail: false,
        calls: Arc::new(Mutex::new(Vec::new())),
    })]);
    let result = primary
        .execute(json!({"url": "https://example.com/direct"}), &())
        .await?;
    assert_eq!(result["provider"], "exa");
    Ok(())
}

#[tokio::test]
async fn fetch_returns_the_last_error_and_validates_the_url() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let tool = WebFetchTool::new(vec![
        Box::new(FetchStub {
            name: "native",
            fail: true,
            calls: Arc::clone(&calls),
        }),
        Box::new(FetchStub {
            name: "exa",
            fail: true,
            calls,
        }),
    ]);
    let error = tool
        .execute(json!({"url": "https://example.com"}), &())
        .await
        .err()
        .unwrap_or_else(|| panic!("every failing backend returns the last error"));
    assert_eq!(error.to_string(), "execution error: exa unavailable");
    for args in [json!({}), json!({"url": ""}), json!({"url": 7})] {
        let error = tool
            .execute(args, &())
            .await
            .err()
            .unwrap_or_else(|| panic!("invalid URL must fail"));
        assert!(matches!(error, ToolError::Validation(_)));
    }
}

#[test]
#[should_panic(expected = "web_fetch requires a backend")]
fn fetch_cannot_be_constructed_without_a_backend() {
    let _ = WebFetchTool::new(vec![]);
}
