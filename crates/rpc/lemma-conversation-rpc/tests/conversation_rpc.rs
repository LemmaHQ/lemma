//! `ConversationRpc` as a value hosts hold and log.

use lemma_conversation::ConversationService;
use lemma_conversation_rpc::ConversationRpc;
use sea_orm::DatabaseConnection;

#[test]
fn debug_output_never_reveals_the_signing_secret() {
    let rpc = ConversationRpc::new(
        ConversationService::new(DatabaseConnection::default()),
        "jwt-secret".to_owned(),
    );

    let debug = format!("{rpc:?}");

    assert!(
        debug.starts_with("ConversationRpc") && !debug.contains("jwt-secret"),
        "{debug}"
    );
}
