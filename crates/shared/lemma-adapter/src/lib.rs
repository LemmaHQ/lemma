//! Canonical provider layer: the only crate that knows vendor wire
//! formats.
//!
//! Adapters translate canonical [`ChatRequest`] values into vendor payloads
//! and vendor streams back into [`StreamEvent`]s from `lemma-core`. HTTP
//! goes through the injectable [`HttpTransport`] so hosts (server, desktop
//! sidecar, mobile) can supply their own networking stack.

mod anthropic;
mod dispatch;
mod error;
mod gemini;
mod openai;
mod provider;
mod request;
mod sse;
mod transport;

pub use anthropic::AnthropicMessages;
pub use dispatch::DispatchProvider;
pub use error::ProviderError;
pub use gemini::GeminiGenerate;
pub use openai::OpenAiCompatible;
pub use provider::{BoxChatFuture, BoxEventStream, Provider};
pub use request::{ChatRequest, ProviderKind};
pub use transport::{ByteStream, HttpTransport, ReqwestTransport};
