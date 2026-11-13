use std::fmt::Debug;

use lemma_tool::{BoxToolFuture, ToolError, WebFetchBackend};
use serde_json::json;

use crate::http_transport::HttpTransport;

/// Native fetch using a plain GET and local HTML text extraction.
#[derive(Debug, Clone)]
pub struct NativeWebBackend<T> {
    transport: T,
}

impl<T: HttpTransport> NativeWebBackend<T> {
    /// Creates a native backend over `transport`.
    #[must_use]
    pub fn new(transport: T) -> Self {
        Self { transport }
    }
}

impl<T: HttpTransport + Debug> WebFetchBackend for NativeWebBackend<T> {
    fn name(&self) -> &'static str {
        "native"
    }

    fn fetch<'exec>(&'exec self, url: String) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let html = self
                .transport
                .get_text(url.clone(), Vec::new())
                .await
                .map_err(|error| ToolError::Execution(error.to_string()))?;
            let (title, content) = extract_html(&html);
            Ok(json!({
                "provider": self.name(),
                "url": url,
                "title": title,
                "content": content,
            }))
        })
    }
}

fn extract_html(html: &str) -> (String, String) {
    let folded = html.to_ascii_lowercase();
    let title = element_text(html, &folded, "title");
    let mut raw = String::new();
    let mut cursor = 0;
    let mut suppressed = None;
    while let Some(relative) = folded[cursor..].find('<') {
        let start = cursor + relative;
        if suppressed.is_none() {
            raw.push_str(&html[cursor..start]);
        }
        if folded[start..].starts_with("<!--") {
            let Some(end) = folded[start + 4..].find("-->") else {
                break;
            };
            cursor = start + 4 + end + 3;
            continue;
        }
        let Some(end) = folded[start..].find('>') else {
            break;
        };
        let tag = folded[start + 1..start + end].trim();
        let closing = tag.starts_with('/');
        let name = tag
            .trim_start_matches('/')
            .trim_start()
            .chars()
            .take_while(char::is_ascii_alphanumeric)
            .collect::<String>();
        if let Some(blocked) = suppressed.as_deref() {
            if closing && name == blocked {
                suppressed = None;
            }
        } else if !closing && matches!(name.as_str(), "script" | "style" | "nav" | "title") {
            suppressed = Some(name);
        } else if is_line_break(&name) {
            raw.push(' ');
        }
        cursor = start + end + 1;
    }
    if suppressed.is_none() {
        raw.push_str(&html[cursor..]);
    }
    (decode_text(title), decode_text(&raw))
}

fn element_text<'html>(html: &'html str, folded: &str, name: &str) -> &'html str {
    let open = format!("<{name}");
    let Some(start) = folded.find(&open) else {
        return "";
    };
    let Some(open_end) = folded[start..].find('>') else {
        return "";
    };
    let content_start = start + open_end + 1;
    let close = format!("</{name}>");
    let Some(content_end) = folded[content_start..].find(&close) else {
        return "";
    };
    &html[content_start..content_start + content_end]
}

fn is_line_break(name: &str) -> bool {
    matches!(
        name,
        "article"
            | "blockquote"
            | "br"
            | "div"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "li"
            | "p"
            | "pre"
            | "section"
            | "tr"
    )
}

fn decode_text(text: &str) -> String {
    let mut decoded = String::new();
    let mut cursor = 0;
    while let Some(relative) = text[cursor..].find('&') {
        let start = cursor + relative;
        decoded.push_str(&text[cursor..start]);
        let Some(end) = text[start..].find(';') else {
            decoded.push_str(&text[start..]);
            return normalize(&decoded);
        };
        let entity = &text[start + 1..start + end];
        if let Some(character) = entity_char(entity) {
            decoded.push(character);
        } else {
            decoded.push_str(&text[start..=start + end]);
        }
        cursor = start + end + 1;
    }
    decoded.push_str(&text[cursor..]);
    normalize(&decoded)
}

fn entity_char(entity: &str) -> Option<char> {
    match entity {
        "amp" => Some('&'),
        "apos" | "#39" => Some('\''),
        "gt" => Some('>'),
        "lt" => Some('<'),
        "nbsp" => Some(' '),
        "quot" => Some('"'),
        _ => entity
            .strip_prefix("#x")
            .or_else(|| entity.strip_prefix("#X"))
            .and_then(|digits| u32::from_str_radix(digits, 16).ok())
            .or_else(|| {
                entity
                    .strip_prefix('#')
                    .and_then(|digits| digits.parse().ok())
            })
            .and_then(char::from_u32),
    }
}

fn normalize(text: &str) -> String {
    let mut normalized = String::new();
    for word in text.split_whitespace() {
        if !normalized.is_empty() {
            normalized.push(' ');
        }
        normalized.push_str(word);
    }
    normalized
}
