use lemma_core::{ContentBlock, Message, ToolSpec};

/// Vendor family selecting the wire protocol of a chat request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    /// OpenAI chat-completions and compatible APIs.
    OpenAiCompatible,
    /// Anthropic Messages API.
    Anthropic,
    /// Google Gemini generateContent API.
    Gemini,
}

/// One streaming chat call against a provider.
#[derive(Debug, Clone)]
pub struct ChatRequest {
    /// Vendor family selecting the adapter.
    pub kind: ProviderKind,
    /// Provider base URL, e.g. `https://api.openai.com/v1`.
    pub base_url: String,
    /// API path override; empty selects the adapter default.
    pub api_path: String,
    /// Plaintext key, opened from its sealed form just before the call.
    pub api_key: String,
    /// Model id as the vendor expects it.
    pub model: String,
    /// Conversation history in canonical form.
    pub messages: Vec<Message>,
    /// Tool definitions advertised to the model; empty disables tool use.
    pub tools: Vec<ToolSpec>,
    /// Reasoning effort knob (`low`/`medium`/`high` or a numeric budget),
    /// forwarded to the vendor's thinking control when set and non-empty.
    pub thinking_effort: Option<String>,
}

/// Joins the text blocks of a content list into one string.
pub(crate) fn text_of(content: &[ContentBlock]) -> String {
    content
        .iter()
        .filter_map(|b| match b {
            ContentBlock::Text(t) => Some(t.text.as_str()),
            _ => None,
        })
        .collect()
}

/// Parses a string into JSON, falling back to `fallback` when the text
/// is not valid JSON.
pub(crate) fn parse_args(arguments: &str, fallback: serde_json::Value) -> serde_json::Value {
    serde_json::from_str(arguments).unwrap_or(fallback)
}

/// Encodes history for the OpenAI chat-completions wire format.
pub(crate) fn openai_messages(messages: &[Message]) -> Vec<serde_json::Value> {
    messages
        .iter()
        .map(|m| match m {
            Message::User { content } => serde_json::json!({
                "role": "user",
                "content": text_of(content),
            }),
            Message::Assistant { content, .. } => {
                let calls: Vec<_> = content
                    .iter()
                    .filter_map(|b| match b {
                        ContentBlock::ToolCall(c) => Some(serde_json::json!({
                            "id": c.id,
                            "type": "function",
                            "function": { "name": c.name, "arguments": c.arguments.to_string() },
                        })),
                        _ => None,
                    })
                    .collect();
                let mut msg = serde_json::json!({
                    "role": "assistant",
                    "content": text_of(content),
                });
                if !calls.is_empty() {
                    msg["tool_calls"] = serde_json::Value::Array(calls);
                }
                msg
            }
            Message::ToolResult {
                tool_call_id,
                content,
                ..
            } => serde_json::json!({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": text_of(content),
            }),
        })
        .collect()
}

/// Encodes history for the Anthropic Messages wire format. Pure-text
/// messages keep the plain string content form; assistant turns with
/// thinking or tool calls switch to content-block arrays.
pub(crate) fn anthropic_messages(messages: &[Message]) -> Vec<serde_json::Value> {
    messages
        .iter()
        .map(|m| match m {
            Message::User { content } => serde_json::json!({
                "role": "user",
                "content": text_of(content),
            }),
            Message::Assistant { content, .. } => {
                let structured = content
                    .iter()
                    .any(|b| !matches!(b, ContentBlock::Text(_)));
                if !structured {
                    return serde_json::json!({
                        "role": "assistant",
                        "content": text_of(content),
                    });
                }
                let blocks: Vec<_> = content
                    .iter()
                    .filter_map(|b| match b {
                        ContentBlock::Text(t) => Some(serde_json::json!({
                            "type": "text",
                            "text": t.text,
                        })),
                        ContentBlock::Thinking(t) => t.signature.as_ref().map(|signature| {
                            serde_json::json!({
                                "type": "thinking",
                                "thinking": t.thinking,
                                "signature": signature,
                            })
                        }),
                        ContentBlock::ToolCall(c) => Some(serde_json::json!({
                            "type": "tool_use",
                            "id": c.id,
                            "name": c.name,
                            "input": c.arguments,
                        })),
                        _ => None,
                    })
                    .collect();
                serde_json::json!({
                    "role": "assistant",
                    "content": blocks,
                })
            }
            Message::ToolResult {
                tool_call_id,
                content,
                is_error,
                ..
            } => serde_json::json!({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_call_id,
                    "content": text_of(content),
                    "is_error": is_error,
                }],
            }),
        })
        .collect()
}

/// Encodes history for the Gemini generateContent wire format.
pub(crate) fn gemini_contents(messages: &[Message]) -> Vec<serde_json::Value> {
    messages
        .iter()
        .map(|m| match m {
            Message::User { content } => serde_json::json!({
                "role": "user",
                "parts": [{ "text": text_of(content) }],
            }),
            Message::Assistant { content, .. } => {
                let calls: Vec<_> = content
                    .iter()
                    .filter_map(|b| match b {
                        ContentBlock::ToolCall(c) => Some(serde_json::json!({
                            "functionCall": {
                                "name": c.name,
                                "args": c.arguments,
                            },
                        })),
                        _ => None,
                    })
                    .collect();
                if calls.is_empty() {
                    return serde_json::json!({
                        "role": "model",
                        "parts": [{ "text": text_of(content) }],
                    });
                }
                let mut parts = Vec::new();
                let text = text_of(content);
                if !text.is_empty() {
                    parts.push(serde_json::json!({ "text": text }));
                }
                parts.extend(calls);
                serde_json::json!({
                    "role": "model",
                    "parts": parts,
                })
            }
            Message::ToolResult {
                tool_name, content, ..
            } => serde_json::json!({
                "role": "user",
                "parts": [{
                    "functionResponse": {
                        "name": tool_name,
                        "response": parse_args(
                            &text_of(content),
                            serde_json::json!({ "text": text_of(content) }),
                        ),
                    },
                }],
            }),
        })
        .collect()
}

/// Maps a thinking-effort knob to a token budget: a numeric string is
/// used verbatim, named tiers map to fixed budgets, and anything else
/// falls back to the medium tier.
pub(crate) fn thinking_budget(effort: &str) -> u32 {
    effort.parse::<u32>().unwrap_or(match effort {
        "low" => 2048,
        "high" => 16384,
        _ => 8192,
    })
}

