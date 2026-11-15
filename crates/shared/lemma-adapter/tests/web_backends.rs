//! Web backend requests, normalized responses, and HTML extraction.

use std::collections::VecDeque;
use std::error::Error;
use std::future::pending;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use futures::stream;
use lemma_adapter::{
    ByteStream, DeepSeekWebBackend, ExaWebBackend, HttpTransport, NativeWebBackend,
};
use lemma_model::ModelError;
use lemma_tool::{Tool, WebFetchBackend, WebSearchBackend, WebSearchTool};
use serde_json::{Value, json};

#[derive(Debug, Clone, PartialEq)]
struct Sent {
    url: String,
    headers: Vec<(String, String)>,
    body: Option<Value>,
}

type PostChunks = Vec<Result<String, String>>;
type PostResponse = Result<PostChunks, ModelError>;

#[derive(Debug, Clone, Default)]
struct ScriptedTransport {
    posts: Arc<Mutex<VecDeque<PostResponse>>>,
    texts: Arc<Mutex<VecDeque<Result<String, ModelError>>>>,
    sent: Arc<Mutex<Vec<Sent>>>,
}

impl ScriptedTransport {
    fn posting(response: &Value) -> Self {
        let transport = Self::default();
        transport.push_post(response);
        transport
    }

    fn push_post(&self, response: &Value) {
        lock(&self.posts).push_back(Ok(vec![Ok(response.to_string())]));
    }

    fn push_post_error(&self, message: &str) {
        lock(&self.posts).push_back(Err(ModelError::new(message.to_owned())));
    }

    fn getting(text: Result<&str, &str>) -> Self {
        let transport = Self::default();
        lock(&transport.texts).push_back(
            text.map(str::to_owned)
                .map_err(|error| ModelError::new(error.to_owned())),
        );
        transport
    }

    fn sent(&self) -> Vec<Sent> {
        lock(&self.sent).clone()
    }
}

impl HttpTransport for ScriptedTransport {
    async fn post_stream(
        &self,
        url: String,
        headers: Vec<(String, String)>,
        body: Value,
    ) -> Result<ByteStream, ModelError> {
        lock(&self.sent).push(Sent {
            url,
            headers,
            body: Some(body),
        });
        let chunks = lock(&self.posts)
            .pop_front()
            .unwrap_or_else(|| Err(ModelError::new("no scripted POST response".to_owned())))?;
        let chunks = chunks
            .into_iter()
            .map(|chunk| chunk.map(String::into_bytes).map_err(ModelError::new));
        Ok(Box::pin(stream::iter(chunks)))
    }

    async fn get_json(
        &self,
        _url: String,
        _headers: Vec<(String, String)>,
    ) -> Result<Value, ModelError> {
        Err(ModelError::new("unexpected JSON GET".to_owned()))
    }

    async fn get_text(
        &self,
        url: String,
        headers: Vec<(String, String)>,
    ) -> Result<String, ModelError> {
        lock(&self.sent).push(Sent {
            url,
            headers,
            body: None,
        });
        lock(&self.texts)
            .pop_front()
            .unwrap_or_else(|| Err(ModelError::new("no scripted text response".to_owned())))
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

#[derive(Debug, Clone)]
struct HangingTransport;

impl HttpTransport for HangingTransport {
    async fn post_stream(
        &self,
        _url: String,
        _headers: Vec<(String, String)>,
        _body: Value,
    ) -> Result<ByteStream, ModelError> {
        pending().await
    }

    async fn get_json(
        &self,
        _url: String,
        _headers: Vec<(String, String)>,
    ) -> Result<Value, ModelError> {
        pending().await
    }

    async fn get_text(
        &self,
        _url: String,
        _headers: Vec<(String, String)>,
    ) -> Result<String, ModelError> {
        pending().await
    }
}

fn exa(transport: ScriptedTransport) -> ExaWebBackend<ScriptedTransport> {
    ExaWebBackend::new(
        "https://exa.example/".to_owned(),
        "exa-key".to_owned(),
        transport,
    )
}

fn deepseek(transport: ScriptedTransport) -> DeepSeekWebBackend<ScriptedTransport> {
    DeepSeekWebBackend::new(
        "https://deepseek.example/".to_owned(),
        "deepseek-key".to_owned(),
        transport,
    )
}

#[tokio::test]
async fn exa_search_applies_defaults_and_normalizes_highlights() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::posting(&json!({
        "results": [{
            "title": "Lemma",
            "url": "https://example.com/lemma",
            "publishedDate": "2026-11-01",
            "highlights": ["first", "second"]
        }]
    }));
    let backend = exa(transport.clone());
    assert_eq!(WebSearchBackend::name(&backend), "exa");
    assert_eq!(WebFetchBackend::name(&backend), "exa");
    assert_eq!(
        backend.spec().parameters["properties"]["numResults"]["maximum"],
        100
    );
    assert_eq!(
        backend.fallback_args(&json!({"query": "lemma", "count": 4, "need_content": true})),
        json!({"query": "lemma", "numResults": 4})
    );
    assert_eq!(
        backend.fallback_args(&json!({"query": "lemma"})),
        json!({"query": "lemma"}),
        "no count to translate"
    );

    let result = backend.search(json!({"query": "lemma"})).await?;

    assert_eq!(
        result,
        json!({"provider": "exa", "results": [{
            "title": "Lemma",
            "url": "https://example.com/lemma",
            "date": "2026-11-01",
            "text": "first\nsecond"
        }]})
    );
    assert_eq!(
        transport.sent(),
        [Sent {
            url: "https://exa.example/search".to_owned(),
            headers: vec![("x-api-key".to_owned(), "exa-key".to_owned())],
            body: Some(json!({
                "query": "lemma",
                "type": "auto",
                "contents": {"highlights": true}
            })),
        }]
    );
    Ok(())
}

#[tokio::test]
async fn deepseek_search_forwards_its_full_parameters() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::posting(&json!({
        "results": [{"title": "Lemma", "url": "https://example.com", "date": null, "summary": "summary"}]
    }));
    let backend = deepseek(transport.clone());
    assert_eq!(WebSearchBackend::name(&backend), "deepseek");
    assert_eq!(WebFetchBackend::name(&backend), "deepseek");
    assert_eq!(
        backend.spec().parameters["properties"]["count"]["maximum"],
        50
    );
    assert_eq!(
        backend.fallback_args(&json!({"query": "lemma", "numResults": 7, "contents": {}})),
        json!({"query": "lemma", "count": 7})
    );
    assert_eq!(
        backend.fallback_args(&json!({"query": "lemma"})),
        json!({"query": "lemma"}),
        "no numResults to translate"
    );
    let args = json!({
        "query": "lemma",
        "count": 7,
        "ori_question": "What is Lemma?",
        "localization": "en-US",
        "need_content": true
    });

    let result = backend.search(args.clone()).await?;

    assert_eq!(result["results"][0]["text"], "summary");
    assert_eq!(result["results"][0]["date"], Value::Null);
    assert_eq!(transport.sent()[0].body, Some(args));
    assert_eq!(
        transport.sent()[0].headers,
        [("authorization".to_owned(), "Bearer deepseek-key".to_owned())]
    );
    assert_eq!(
        transport.sent()[0].url,
        "https://deepseek.example/v1/tools/search"
    );
    Ok(())
}

#[tokio::test]
async fn concrete_search_fallback_translates_exa_arguments_for_deepseek()
-> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::default();
    transport.push_post_error("Exa unavailable");
    transport.push_post(&json!({"results": []}));
    let tool = WebSearchTool::new(vec![
        Box::new(exa(transport.clone())),
        Box::new(deepseek(transport.clone())),
    ]);
    let args = json!({
        "query": "lemma",
        "numResults": 2,
        "type": "deep",
        "contents": {"text": true}
    });

    let result = tool.execute(args.clone(), &()).await?;

    assert_eq!(result["provider"], "deepseek");
    let sent = transport.sent();
    assert_eq!(sent[0].body, Some(args));
    assert_eq!(sent[1].body, Some(json!({"query": "lemma", "count": 2})));
    Ok(())
}

#[tokio::test]
async fn concrete_search_fallback_translates_deepseek_arguments_for_exa()
-> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::default();
    transport.push_post_error("DeepSeek unavailable");
    transport.push_post(&json!({"results": []}));
    let tool = WebSearchTool::new(vec![
        Box::new(deepseek(transport.clone())),
        Box::new(exa(transport.clone())),
    ]);
    let args = json!({
        "query": "lemma",
        "count": 3,
        "freshness": "week"
    });

    let result = tool.execute(args.clone(), &()).await?;

    assert_eq!(result["provider"], "exa");
    let sent = transport.sent();
    assert_eq!(sent[0].body, Some(args));
    assert_eq!(
        sent[1].body,
        Some(json!({
            "query": "lemma",
            "numResults": 3,
            "type": "auto",
            "contents": {"highlights": true}
        }))
    );
    Ok(())
}

#[tokio::test]
async fn exa_and_deepseek_fetch_normalize_markdown() -> Result<(), Box<dyn Error>> {
    let exa_transport = ScriptedTransport::posting(&json!({
        "results": [{"title": "Exa page", "url": "https://example.com/exa", "text": "exa text"}],
        "statuses": [{"status": "success", "error": null}]
    }));
    let exa_result = exa(exa_transport.clone())
        .fetch("https://example.com/exa".to_owned())
        .await?;
    assert_eq!(
        exa_result,
        json!({"provider": "exa", "url": "https://example.com/exa", "title": "Exa page", "content": "exa text"})
    );
    assert_eq!(
        exa_transport.sent()[0].body,
        Some(json!({"ids": ["https://example.com/exa"], "text": {}}))
    );

    let deepseek_transport =
        ScriptedTransport::posting(&json!({"title": "Deep page", "content": "markdown"}));
    let deepseek_result = deepseek(deepseek_transport.clone())
        .fetch("https://example.com/deep".to_owned())
        .await?;
    assert_eq!(
        deepseek_result,
        json!({"provider": "deepseek", "url": "https://example.com/deep", "title": "Deep page", "content": "markdown"})
    );
    assert_eq!(
        deepseek_transport.sent()[0].url,
        "https://deepseek.example/v1/tools/fetch"
    );
    Ok(())
}

#[tokio::test]
async fn exa_fetch_rejects_error_statuses_and_missing_content() {
    let status_transport = ScriptedTransport::posting(&json!({
        "results": [],
        "statuses": [{"status": "error", "error": {"message": "not found"}}]
    }));
    let error = exa(status_transport)
        .fetch("https://example.com/missing".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("error status fails"));
    assert!(error.to_string().contains("not found"), "{error}");

    let bare_status_transport = ScriptedTransport::posting(
        &json!({"results": [], "statuses": [{"status": "error", "error": null}]}),
    );
    let error = exa(bare_status_transport)
        .fetch("https://example.com/error".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("bare error status fails"));
    assert!(error.to_string().contains("\"error\""), "{error}");

    let empty_transport = ScriptedTransport::posting(&json!({
        "results": [{"title": null, "url": null, "text": ""}]
    }));
    let error = exa(empty_transport)
        .fetch("https://example.com/empty".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("empty text fails"));
    assert!(error.to_string().contains("empty content"), "{error}");

    let missing_transport = ScriptedTransport::posting(&json!({"results": []}));
    let error = exa(missing_transport)
        .fetch("https://example.com/none".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("missing result fails"));
    assert!(error.to_string().contains("no result"), "{error}");
}

#[tokio::test]
async fn malformed_web_responses_are_execution_errors() {
    let invalid_json = ScriptedTransport::default();
    lock(&invalid_json.posts).push_back(Ok(vec![Ok("not json".to_owned())]));
    let error = exa(invalid_json)
        .search(json!({"query": "lemma"}))
        .await
        .err()
        .unwrap_or_else(|| panic!("invalid JSON fails"));
    assert!(error.to_string().contains("bad web response"), "{error}");

    let invalid_schema = ScriptedTransport::posting(&json!({"unexpected": true}));
    let error = deepseek(invalid_schema)
        .fetch("https://example.com".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("invalid schema fails"));
    assert!(
        error.to_string().contains("bad DeepSeek fetch response"),
        "{error}"
    );

    let invalid_exa_search = ScriptedTransport::posting(&json!({"results": [{"url": 1}]}));
    let error = exa(invalid_exa_search)
        .search(json!({"query": "lemma"}))
        .await
        .err()
        .unwrap_or_else(|| panic!("invalid Exa search schema fails"));
    assert!(
        error.to_string().contains("bad Exa search response"),
        "{error}"
    );

    let invalid_exa_fetch = ScriptedTransport::posting(&json!({"results": "wrong"}));
    let error = exa(invalid_exa_fetch)
        .fetch("https://example.com".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("invalid Exa fetch schema fails"));
    assert!(
        error.to_string().contains("bad Exa fetch response"),
        "{error}"
    );

    let invalid_deepseek_search = ScriptedTransport::posting(&json!({"results": [{"title": 1}]}));
    let error = deepseek(invalid_deepseek_search)
        .search(json!({"query": "lemma"}))
        .await
        .err()
        .unwrap_or_else(|| panic!("invalid DeepSeek search schema fails"));
    assert!(
        error.to_string().contains("bad DeepSeek search response"),
        "{error}"
    );

    let interrupted = ScriptedTransport::default();
    lock(&interrupted.posts).push_back(Ok(vec![Err("connection lost".to_owned())]));
    let error = exa(interrupted)
        .search(json!({"query": "lemma"}))
        .await
        .err()
        .unwrap_or_else(|| panic!("stream failure fails"));
    assert!(error.to_string().contains("connection lost"), "{error}");
}

#[tokio::test(start_paused = true)]
async fn a_hanging_web_post_times_out_after_sixty_seconds() {
    let backend = ExaWebBackend::new(
        "https://exa.example".to_owned(),
        "key".to_owned(),
        HangingTransport,
    );

    let result = backend.search(json!({"query": "lemma"})).await;

    let error = result
        .err()
        .unwrap_or_else(|| panic!("hanging POST must time out"));
    assert!(
        error.to_string().contains("timed out after 60 seconds"),
        "{error}"
    );
}

#[tokio::test]
async fn native_fetch_extracts_text_without_navigation_or_script() -> Result<(), Box<dyn Error>> {
    let transport = ScriptedTransport::getting(Ok(
        r#"<html><head><title>A &amp; B</title><style>hidden</style></head>
        <body><nav>Menu</nav><script>alert('hidden')</script><!-- hidden -->
        <main><h1>Heading</h1><p>Hello&nbsp;<b>world</b> &lt;3 &#33;</p>
        <div>Next<br>line &unknown;</div></main></body></html>"#,
    ));
    let backend = NativeWebBackend::new(transport.clone());

    let result = backend.fetch("https://example.com/page".to_owned()).await?;

    assert_eq!(
        result,
        json!({
            "provider": "native",
            "url": "https://example.com/page",
            "title": "A & B",
            "content": "Heading Hello world <3 ! Next line &unknown;"
        })
    );
    assert_eq!(transport.sent()[0].headers, Vec::<(String, String)>::new());
    assert_eq!(transport.sent()[0].body, None);

    let empty = NativeWebBackend::new(ScriptedTransport::getting(Ok("<p>plain</p>")))
        .fetch("https://example.com/plain".to_owned())
        .await?;
    assert_eq!(empty["title"], "");
    assert_eq!(empty["content"], "plain");

    let error = NativeWebBackend::new(ScriptedTransport::getting(Err("GET failed")))
        .fetch("https://example.com/error".to_owned())
        .await
        .err()
        .unwrap_or_else(|| panic!("GET failure fails"));
    assert!(error.to_string().contains("GET failed"), "{error}");
    Ok(())
}

#[tokio::test]
async fn native_fetch_handles_malformed_html_and_all_entity_forms() -> Result<(), Box<dyn Error>> {
    let cases = [
        ("<p>shown</p><!--", "", "shown <!--"),
        ("<p>shown</p><", "", "shown <"),
        ("<title", "", "<title"),
        ("<title>x<p>body</p>", "", ""),
        ("<p>A & B</p>", "", "A & B"),
        ("<p>&apos; &gt; &quot; &#x41; &#X42;</p>", "", "' > \" A B"),
    ];
    for (html, title, content) in cases {
        let result = NativeWebBackend::new(ScriptedTransport::getting(Ok(html)))
            .fetch("https://example.com/malformed".to_owned())
            .await?;
        assert_eq!(result["title"], title, "title for {html}");
        assert_eq!(result["content"], content, "content for {html}");
    }
    Ok(())
}
