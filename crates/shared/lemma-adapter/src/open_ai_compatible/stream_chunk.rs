use lemma_core::StopReason;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct StreamChunk {
    #[serde(default)]
    pub(super) choices: Vec<StreamChoice>,
    pub(super) usage: Option<RawUsage>,
}

#[derive(Deserialize)]
pub(super) struct StreamChoice {
    pub(super) delta: Option<StreamDelta>,
    pub(super) finish_reason: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct StreamDelta {
    pub(super) content: Option<String>,
    pub(super) reasoning_content: Option<String>,
    pub(super) reasoning: Option<String>,
    #[serde(default)]
    pub(super) tool_calls: Vec<RawToolCall>,
}

#[derive(Deserialize)]
pub(super) struct RawToolCall {
    pub(super) index: Option<usize>,
    pub(super) id: Option<String>,
    pub(super) function: Option<RawFunction>,
}

#[derive(Deserialize)]
pub(super) struct RawFunction {
    pub(super) name: Option<String>,
    pub(super) arguments: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct RawUsage {
    pub(super) prompt_tokens: i64,
    pub(super) completion_tokens: i64,
}

pub(super) fn map_finish_reason(reason: &str) -> StopReason {
    match reason {
        "length" => StopReason::Length,
        "tool_calls" => StopReason::ToolUse,
        _ => StopReason::Stop,
    }
}
