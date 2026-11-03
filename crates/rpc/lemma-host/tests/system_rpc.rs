//! `SystemService` over Connect on a local engine.

mod common;

use std::error::Error;

use common::Engine;
use serde_json::json;

#[tokio::test]
async fn get_version_answers_unauthenticated() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;

    let reply = engine
        .call("/lemma.v1.SystemService/GetVersion", &json!({}))
        .await?;
    engine.close().await?;

    assert_eq!(reply.status, 200, "{reply:?}");
    assert_eq!(
        reply.body,
        json!({ "version": env!("CARGO_PKG_VERSION") }),
        "the workspace release version"
    );
    Ok(())
}
