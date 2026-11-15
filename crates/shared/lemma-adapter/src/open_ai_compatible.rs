//! Adapter for OpenAI-compatible chat completions APIs.

mod adapter;
mod parser;
mod stream_chunk;

pub(crate) use adapter::OpenAiCompatible;
