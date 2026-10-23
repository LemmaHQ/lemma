//! The agent: assembles one turn from a user's request (provider adapter,
//! conversation store, workspace tools) and runs it on the agent loop.
//! Hosts call only this crate and map its [`TurnEvent`]s onto their own
//! event types.

mod agent;
mod agent_error;

pub use agent::{Agent, Turn, TurnRequest};
pub use agent_error::AgentError;
pub use lemma_agent_loop::{TurnEnd, TurnEvent};
