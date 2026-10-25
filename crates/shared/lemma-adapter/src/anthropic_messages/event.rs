use lemma_core::StopReason;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct Event {
    #[serde(rename = "type")]
    pub(super) kind: String,
    pub(super) delta: Option<Delta>,
    pub(super) content_block: Option<ContentBlockStart>,
    pub(super) usage: Option<RawUsage>,
    pub(super) message: Option<MessageStart>,
    pub(super) error: Option<ApiError>,
}

#[derive(Deserialize)]
pub(super) struct Delta {
    #[serde(rename = "type")]
    pub(super) kind: Option<String>,
    pub(super) text: Option<String>,
    pub(super) thinking: Option<String>,
    pub(super) signature: Option<String>,
    pub(super) partial_json: Option<String>,
    pub(super) stop_reason: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct ContentBlockStart {
    #[serde(rename = "type")]
    pub(super) kind: String,
    pub(super) id: Option<String>,
    pub(super) name: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct RawUsage {
    pub(super) input_tokens: Option<i64>,
    pub(super) output_tokens: Option<i64>,
}

#[derive(Deserialize)]
pub(super) struct MessageStart {
    pub(super) usage: Option<RawUsage>,
}

#[derive(Deserialize)]
pub(super) struct ApiError {
    pub(super) message: String,
}

pub(super) fn map_stop_reason(reason: &str) -> StopReason {
    match reason {
        "max_tokens" => StopReason::Length,
        "tool_use" => StopReason::ToolUse,
        _ => StopReason::Stop,
    }
}
