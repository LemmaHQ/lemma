//! `AgentRpc` as a value hosts hold and log.

use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::Agent;
use lemma_agent_rpc::AgentRpc;
use lemma_conversation::ConversationService;
use lemma_provider::ProviderService;
use sea_orm::DatabaseConnection;

#[test]
fn debug_output_never_reveals_the_signing_secret() {
    let db = DatabaseConnection::default();
    let providers = ProviderService::new(
        db.clone(),
        "00".repeat(32),
        HttpConnector::new(ReqwestTransport::new()),
    );
    let agent = Agent::new(ConversationService::new(db), Arc::new(providers), None);
    let rpc = AgentRpc::new(agent, "jwt-secret".to_owned());

    let debug = format!("{rpc:?}");

    assert!(
        debug.starts_with("AgentRpc") && !debug.contains("jwt-secret"),
        "{debug}"
    );
}
