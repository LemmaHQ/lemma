//! Model adapters: the only crate that knows vendor wire formats.
//!
//! Each adapter implements `lemma_model::Adapter` for one provider kind,
//! translating [`ModelRequest`](lemma_model::ModelRequest) values into
//! vendor payloads and vendor streams back into `StreamEvent`s.
//! [`HttpConnector`] implements `lemma_model::Connector`, binding endpoints
//! to adapters and listing their models. HTTP goes through the injectable
//! [`HttpTransport`] so hosts (server, desktop engine, mobile) can supply
//! their own networking stack.

mod anthropic_messages;
mod error;
mod gemini_generate;
mod http_connector;
mod http_transport;
mod model_adapter;
mod models;
mod open_ai_compatible;
mod request;
mod sse;

pub use anthropic_messages::AnthropicMessages;
pub use gemini_generate::GeminiGenerate;
pub use http_connector::HttpConnector;
pub use http_transport::{ByteStream, HttpTransport, ReqwestTransport};
pub use model_adapter::ModelAdapter;
pub use open_ai_compatible::OpenAiCompatible;
