//! Model adapters: the only crate that knows vendor wire formats.
//!
//! Each adapter implements `lemma_model::Adapter` for one API format,
//! translating [`ModelRequest`](lemma_model::ModelRequest) values into
//! vendor payloads and vendor streams back into `StreamEvent`s.
//! [`HttpConnector`] implements `lemma_model::Connector`, binding endpoints
//! to adapters and listing their models over an injectable [`HttpTransport`].
//!
//! # Adapter invariants
//!
//! - **Base URLs and paths:** the API version segment belongs to `base_url`
//!   for OpenAI-compatible endpoints (default `/v1`) and to the default path
//!   for Anthropic (`/v1/messages`) and Gemini (`/v1beta/models/...`). A
//!   Gemini path override may include `{model}`, which is substituted with the
//!   model id; Gemini model list ids strip the `models/` prefix.
//! - **SSE stream order:** only `data:` lines are parsed. An open text block
//!   always closes with `TextEnd` before a thinking block, a tool call, or
//!   `Done`. If the upstream body closes without a terminal chunk, the shared
//!   SSE layer emits a final `Done` from what was observed.
//! - **No retries:** adapters never retry failed requests; every transport,
//!   non-2xx upstream, or parse failure surfaces as `ModelError`.

mod anthropic_messages;
mod connection;
mod error;
mod gemini_generate;
mod http_connector;
mod http_transport;
mod model_adapter;
mod models;
mod open_ai_compatible;
mod request;
mod sse;
mod web;

pub use http_connector::HttpConnector;
pub use http_transport::{ByteStream, HttpTransport, ReqwestTransport};
pub use model_adapter::ModelAdapter;
pub use web::{DeepSeekWebBackend, ExaWebBackend, NativeWebBackend};
