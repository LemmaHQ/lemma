use lemma_core::{StopReason, Usage};
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct Chunk {
    #[serde(default)]
    pub(super) candidates: Vec<Candidate>,
    #[serde(rename = "usageMetadata")]
    pub(super) usage: Option<UsageMeta>,
}

#[derive(Deserialize)]
pub(super) struct Candidate {
    pub(super) content: Option<Content>,
    #[serde(rename = "finishReason")]
    pub(super) finish_reason: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct Content {
    #[serde(default)]
    pub(super) parts: Vec<Part>,
}

#[derive(Deserialize)]
pub(super) struct Part {
    pub(super) text: Option<String>,
    #[serde(default)]
    pub(super) thought: bool,
    #[serde(rename = "thoughtSignature")]
    pub(super) thought_signature: Option<String>,
    #[serde(rename = "functionCall")]
    pub(super) function_call: Option<FunctionCall>,
}

#[derive(Deserialize)]
pub(super) struct FunctionCall {
    pub(super) name: String,
    #[serde(default)]
    pub(super) args: serde_json::Value,
}

#[derive(Deserialize)]
pub(super) struct UsageMeta {
    #[serde(rename = "promptTokenCount")]
    pub(super) prompt: Option<i64>,
    #[serde(rename = "candidatesTokenCount")]
    pub(super) completion: Option<i64>,
}

impl From<UsageMeta> for Usage {
    fn from(u: UsageMeta) -> Self {
        Self {
            input: u.prompt.unwrap_or(0),
            output: u.completion.unwrap_or(0),
        }
    }
}

pub(super) fn map_finish_reason(reason: &str) -> StopReason {
    match reason {
        "MAX_TOKENS" => StopReason::Length,
        _ => StopReason::Stop,
    }
}
