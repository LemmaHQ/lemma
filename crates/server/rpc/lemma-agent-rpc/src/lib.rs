//! Connect RPC shell exposing `lemma_agent::Agent` as the `AgentService`.

mod agent_rpc;
mod live_turns;

pub use agent_rpc::AgentRpc;
