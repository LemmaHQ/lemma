//! The agent loop: runs one turn over the message tree, calling the model
//! through a `lemma_model::Adapter` and executing requested tools. It knows
//! no vendor, credential, or host.

mod agent_loop;
mod cancel_token;
mod loop_error;
mod persist;
mod stream;
mod tool_runtime;
mod turn_event;

pub use agent_loop::{AgentLoop, TurnEnd, TurnInput};
pub use cancel_token::CancelToken;
pub use loop_error::LoopError;
pub use tool_runtime::ToolRuntime;
pub use turn_event::TurnEvent;
