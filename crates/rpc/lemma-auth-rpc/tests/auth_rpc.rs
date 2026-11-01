//! `AuthRpc` as a value hosts hold and log.

use lemma_auth_rpc::AuthRpc;
use sea_orm::DatabaseConnection;

#[test]
fn debug_output_never_reveals_the_signing_secret() {
    let rpc = AuthRpc::new(DatabaseConnection::default(), "jwt-secret".to_owned());

    let debug = format!("{rpc:?}");

    assert!(
        debug.starts_with("AuthRpc") && !debug.contains("jwt-secret"),
        "{debug}"
    );
}
