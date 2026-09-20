//! Bridge from the canonical provider stream to this service's
//! text-only upstream events.

use std::pin::Pin;

use futures::{Stream, StreamExt};
use lemma_adapter::{BoxEventStream, ProviderError, ProviderKind};
use lemma_db_server::entity::{Message as DbMessage, TokenUsage};
use lemma_proto::lemma::v1::ProviderKind as ProtoProviderKind;
use lemma_trace::{ContentBlock, Message, StopReason, StreamEvent, TextContent, Usage};

/// One upstream generation event as the chat service consumes it.
#[derive(Debug)]
pub enum UpstreamEvent {
    /// A chunk of generated text.
    Delta(String),
    /// Generation finished, optionally with token usage.
    Done(Option<TokenUsage>),
}

/// Stream of upstream events.
pub type BoxUpstreamStream =
    Pin<Box<dyn Stream<Item = Result<UpstreamEvent, ProviderError>> + Send>>;

/// Maps the proto provider kind onto the canonical provider kind.
/// Unspecified and unrecognized kinds select the OpenAI-compatible
/// adapter, the most common API shape.
pub fn kind_of(kind: ProtoProviderKind) -> ProviderKind {
    match kind {
        ProtoProviderKind::PROVIDER_KIND_ANTHROPIC => ProviderKind::Anthropic,
        ProtoProviderKind::PROVIDER_KIND_GEMINI => ProviderKind::Gemini,
        _ => ProviderKind::OpenAiCompatible,
    }
}

/// Converts persisted history rows into canonical trace messages. The
/// store only keeps plain text, so every message is a single text block.
pub fn to_trace_messages(history: &[DbMessage]) -> Vec<Message> {
    history
        .iter()
        .map(|m| {
            let block = ContentBlock::Text(TextContent {
                text: m.content.clone(),
            });
            if m.role == "user" {
                Message::User {
                    content: vec![block],
                }
            } else {
                Message::Assistant {
                    content: vec![block],
                    stop_reason: StopReason::Stop,
                    usage: None,
                }
            }
        })
        .collect()
}

fn to_db_usage(usage: Usage) -> TokenUsage {
    TokenUsage {
        prompt: usage.input,
        completion: usage.output,
        total: usage.input + usage.output,
    }
}

/// Adapts a canonical provider stream: text deltas and the terminal
/// usage pass through, block lifecycle markers are dropped, and in-band
/// errors become stream errors.
pub fn bridge(stream: BoxEventStream) -> BoxUpstreamStream {
    Box::pin(stream.filter_map(|item| async move {
        match item {
            Ok(StreamEvent::TextDelta { delta }) => Some(Ok(UpstreamEvent::Delta(delta))),
            Ok(StreamEvent::Done { usage, .. }) => {
                Some(Ok(UpstreamEvent::Done(usage.map(to_db_usage))))
            }
            Ok(StreamEvent::Error { message }) => Some(Err(ProviderError { message })),
            Ok(_) => None,
            Err(e) => Some(Err(e)),
        }
    }))
}
