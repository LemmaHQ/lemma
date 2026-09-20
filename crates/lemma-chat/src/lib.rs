//! Chat domain: streaming message generation through the canonical
//! provider layer, with an in-process stream registry for live fan-out,
//! abort, and resume.

pub mod registry;
mod service;
pub mod store;
mod upstream;

pub use service::ChatService;
