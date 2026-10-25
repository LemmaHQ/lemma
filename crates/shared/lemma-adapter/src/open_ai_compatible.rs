//! Adapter for OpenAI-compatible chat completions APIs.

mod adapter;
mod parser;
mod stream_chunk;

pub use adapter::OpenAiCompatible;
