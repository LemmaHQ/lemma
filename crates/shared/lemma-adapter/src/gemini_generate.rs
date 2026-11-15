//! Adapter for the Gemini generateContent API.

mod adapter;
mod chunk;
mod parser;

pub(crate) use adapter::GeminiGenerate;
