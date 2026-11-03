//! `SessionRpc` as a value hosts hold and log.

use lemma_session::SessionService;
use lemma_session_rpc::SessionRpc;
use sea_orm::DatabaseConnection;

#[test]
fn debug_output_never_reveals_the_signing_secret() {
    let rpc = SessionRpc::new(
        SessionService::new(DatabaseConnection::default()),
        "jwt-secret".to_owned(),
    );

    let debug = format!("{rpc:?}");

    assert!(
        debug.starts_with("SessionRpc") && !debug.contains("jwt-secret"),
        "{debug}"
    );
}
