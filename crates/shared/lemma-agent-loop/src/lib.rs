//! The agent loop: runs one turn over the session tree, calling the model
//! through a `lemma_model::Adapter` and executing requested tools. It knows
//! no vendor, credential, or host.

mod agent_loop;
mod error;
mod event;
mod persist;
mod stream;
mod tool;

pub use agent_loop::{AgentConfig, AgentLoop, TurnInput};
pub use error::LoopError;
pub use event::{TurnEvent, TurnObserver};
pub use tool::ToolRuntime;
