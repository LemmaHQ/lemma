//! The agent loop: runs one turn over the message tree, calling the model
//! through a `lemma_model::Adapter` and executing requested tools. It knows
//! no vendor, credential, or host.

mod agent_loop;
mod cancel;
mod error;
mod event;
mod persist;
mod stream;
mod tool;

pub use agent_loop::{AgentLoop, TurnEnd, TurnInput};
pub use cancel::CancelToken;
pub use error::LoopError;
pub use event::{TurnEvent, TurnObserver};
pub use tool::ToolRuntime;
