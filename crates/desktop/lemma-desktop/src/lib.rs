//! The Lemma desktop application: a GPUI Kit window over the local engine, which runs in the same process.

mod chat_view;
mod engine_runtime;
mod error_text;
mod interface_language;
mod lemma_app;
pub mod lemma_theme;
mod memory_token_store;
mod message_row;
mod session_list;
mod sign_in_view;
pub mod strings;
mod window_header;
mod workspace_view;

pub use engine_runtime::{EngineRuntime, InRuntime};
pub use interface_language::InterfaceLanguage;
pub use lemma_app::LemmaApp;
pub use strings::Language;

#[cfg(test)]
mod tests {
    pub(crate) mod fixture;
}
