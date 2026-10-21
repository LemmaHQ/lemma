//! Model adapters: the only crate that knows vendor wire formats.
//!
//! Each adapter implements `lemma_model::Adapter` for one provider kind,
//! translating [`ModelRequest`](lemma_model::ModelRequest) values into
//! vendor payloads and vendor streams back into `StreamEvent`s.
//! [`HttpConnector`] implements `lemma_model::Connector`, binding endpoints
//! to adapters and listing their models. HTTP goes through the injectable
//! [`HttpTransport`] so hosts (server, desktop sidecar, mobile) can supply
//! their own networking stack.

mod anthropic;
mod connector;
mod error;
mod gemini;
mod models;
mod openai;
mod request;
mod sse;
mod transport;

pub use anthropic::AnthropicMessages;
pub use connector::HttpConnector;
pub use gemini::GeminiGenerate;
pub use openai::OpenAiCompatible;
pub use transport::{BoxTransportFuture, ByteStream, HttpTransport, ReqwestTransport};
