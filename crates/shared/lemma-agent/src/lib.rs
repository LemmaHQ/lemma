//! The agent: assembles one turn from a user's request (provider adapter,
//! sessions, workspace tools) and runs it on the agent loop.
//! Hosts call only this crate and map its [`TurnEvent`]s onto their own
//! event types.

mod active_turns;
mod agent;
mod agent_error;
mod running_turns;
mod web_tools;

pub use active_turns::ActiveTurns;
pub use agent::{Agent, TurnRequest};
pub use agent_error::AgentError;
pub use lemma_agent_loop::TurnEvent;
pub use lemma_session::BranchTarget;
