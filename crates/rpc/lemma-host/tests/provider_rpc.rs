//! `ProviderService` over Connect on a local engine, against an
//! OpenAI-compatible vendor served on the loopback interface.

mod common;

use std::error::Error;

use axum::Router;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use common::{Engine, assert_internal, assert_reason, serve};
use lemma_proto::lemma::v1::ErrorReason;
use serde_json::{Value, json};

const LIST: &str = "/lemma.v1.ProviderService/ListProviders";
const CREATE: &str = "/lemma.v1.ProviderService/CreateProvider";
const UPDATE: &str = "/lemma.v1.ProviderService/UpdateProvider";
const DELETE: &str = "/lemma.v1.ProviderService/DeleteProvider";
const FETCH: &str = "/lemma.v1.ProviderService/FetchModels";
const CHECK: &str = "/lemma.v1.ProviderService/CheckProvider";

async fn vendor() -> Result<String, Box<dyn Error>> {
    let router = Router::new()
        .route(
            "/v1/models",
            get(|headers: HeaderMap| async move {
                if headers
                    .get("authorization")
                    .is_none_or(|v| v != "Bearer sk-1")
                {
                    return (StatusCode::UNAUTHORIZED, "bad key".to_owned());
                }
                (
                    StatusCode::OK,
                    json!({ "data": [{ "id": "m1" }, { "id": "m2" }] }).to_string(),
                )
            }),
        )
        .route(
            "/v1/chat/completions",
            post(|body: String| async move {
                if body.contains("\"model\":\"missing\"") {
                    return (StatusCode::NOT_FOUND, "model not found".to_owned());
                }
                (
                    StatusCode::OK,
                    "data: {\"choices\":[{\"delta\":{\"content\":\"pong\"}}]}\n\ndata: [DONE]\n\n"
                        .to_owned(),
                )
            }),
        );
    Ok(format!("{}/v1", serve(router).await?))
}

fn provider(base_url: &str) -> Value {
    json!({
        "kind": "PROVIDER_KIND_OPENAI",
        "identifier": "main",
        "name": "Main",
        "baseUrl": base_url,
        "apiKey": "sk-1",
        "models": ["m1"],
        "apiPath": "/chat/completions",
        "modelsPath": "/models",
    })
}

async fn create(engine: &Engine, token: &str, body: &Value) -> Result<String, Box<dyn Error>> {
    let reply = engine.call_as(token, CREATE, body).await?;
    reply.body["provider"]["id"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("no provider id in {reply:?}").into())
}

#[tokio::test]
async fn providers_round_trip_through_create_list_update_and_delete() -> Result<(), Box<dyn Error>>
{
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;

    let created = engine
        .call_as(&token, CREATE, &provider("https://api.example.com/v1/"))
        .await?;
    let id = created.body["provider"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let listed = engine.call_as(&token, LIST, &json!({})).await?;
    let updated = engine
        .call_as(
            &token,
            UPDATE,
            &json!({
                "id": id,
                "name": " Backup ",
                "baseUrl": " https://proxy.example.com/v1/ ",
                "apiPath": " /v2/chat ",
                "modelsPath": " /v2/models ",
                "enabled": false,
                "models": { "models": ["m2"] },
            }),
        )
        .await?;
    let deleted = engine.call_as(&token, DELETE, &json!({ "id": id })).await?;
    let after = engine.call_as(&token, LIST, &json!({})).await?;

    assert_eq!(
        created.body["provider"],
        json!({
            "id": id,
            "kind": "PROVIDER_KIND_OPENAI",
            "identifier": "main",
            "name": "Main",
            "baseUrl": "https://api.example.com/v1",
            "apiKey": "sk-1",
            "models": ["m1"],
            "enabled": true,
            "apiPath": "/chat/completions",
            "modelsPath": "/models",
        }),
        "created provider"
    );
    assert_eq!(
        listed.body["providers"],
        json!([created.body["provider"]]),
        "listed"
    );
    assert_eq!(
        updated.body["provider"],
        json!({
            "id": id,
            "kind": "PROVIDER_KIND_OPENAI",
            "identifier": "main",
            "name": "Backup",
            "baseUrl": "https://proxy.example.com/v1",
            "apiKey": "sk-1",
            "models": ["m2"],
            "apiPath": "/v2/chat",
            "modelsPath": "/v2/models",
        }),
        "updated provider, disabled, its key unchanged"
    );
    assert_eq!(deleted.status, 200, "{deleted:?}");
    assert_eq!(
        after.body.get("providers"),
        None,
        "no providers left: {after:?}"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn each_kind_maps_to_its_proto_value() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;

    for (index, kind) in [
        "PROVIDER_KIND_OPENAI",
        "PROVIDER_KIND_ANTHROPIC",
        "PROVIDER_KIND_GEMINI",
    ]
    .into_iter()
    .enumerate()
    {
        let mut body = provider("https://api.example.com");
        body["kind"] = json!(kind);
        body["identifier"] = json!(format!("p{index}"));
        let reply = engine.call_as(&token, CREATE, &body).await?;
        assert_eq!(reply.body["provider"]["kind"], kind, "{reply:?}");
    }
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn invalid_requests_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let ada = engine.token("ada").await?;
    let bob = engine.token("bob").await?;
    let id = create(&engine, &ada, &provider("https://api.example.com")).await?;
    let mut no_kind = provider("https://api.example.com");
    no_kind["kind"] = json!("PROVIDER_KIND_UNSPECIFIED");
    let mut blank_identifier = provider("https://api.example.com");
    blank_identifier["identifier"] = json!(" ");
    let blank_base_url = provider(" ");

    let cases = [
        (
            engine.call(LIST, &json!({})).await?,
            ErrorReason::TokenInvalid,
        ),
        (
            engine.call_as(&ada, CREATE, &no_kind).await?,
            ErrorReason::ProviderKindInvalid,
        ),
        (
            engine.call_as(&ada, CREATE, &blank_identifier).await?,
            ErrorReason::ProviderIdentifierInvalid,
        ),
        (
            engine.call_as(&ada, CREATE, &blank_base_url).await?,
            ErrorReason::ProviderFieldsRequired,
        ),
        (
            engine
                .call_as(&ada, CREATE, &provider("https://api.example.com"))
                .await?,
            ErrorReason::ProviderIdentifierTaken,
        ),
        (
            engine
                .call_as(&ada, UPDATE, &json!({ "id": "x", "name": "n" }))
                .await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine
                .call_as(&bob, UPDATE, &json!({ "id": id, "name": "n" }))
                .await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine.call_as(&bob, DELETE, &json!({ "id": id })).await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine.call_as(&ada, DELETE, &json!({ "id": "x" })).await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine
                .call_as(
                    &ada,
                    FETCH,
                    &json!({ "baseUrl": "https://api.example.com" }),
                )
                .await?,
            ErrorReason::ProviderKindInvalid,
        ),
        (
            engine.call_as(&ada, FETCH, &json!({ "id": "x" })).await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine.call_as(&bob, FETCH, &json!({ "id": id })).await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine
                .call_as(&ada, CHECK, &json!({ "id": id, "model": " " }))
                .await?,
            ErrorReason::ModelRequired,
        ),
        (
            engine
                .call_as(&ada, CHECK, &json!({ "model": "m1" }))
                .await?,
            ErrorReason::ProviderKindInvalid,
        ),
        (
            engine
                .call_as(&bob, CHECK, &json!({ "id": id, "model": "m1" }))
                .await?,
            ErrorReason::ProviderNotFound,
        ),
    ];

    for (reply, reason) in &cases {
        assert_reason(reply, *reason);
    }
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn models_are_fetched_with_the_stored_or_given_key() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;
    let base_url = vendor().await?;
    let id = create(&engine, &token, &provider(&base_url)).await?;

    let stored = engine.call_as(&token, FETCH, &json!({ "id": id })).await?;
    let adhoc = engine
        .call_as(
            &token,
            FETCH,
            &json!({ "kind": "PROVIDER_KIND_OPENAI", "baseUrl": base_url, "apiKey": "sk-1" }),
        )
        .await?;
    let wrong_key = engine
        .call_as(
            &token,
            FETCH,
            &json!({ "kind": "PROVIDER_KIND_OPENAI", "baseUrl": base_url, "apiKey": "sk-2" }),
        )
        .await?;

    assert_eq!(
        stored.body,
        json!({ "models": ["m1", "m2"] }),
        "stored provider"
    );
    assert_eq!(
        adhoc.body,
        json!({ "models": ["m1", "m2"] }),
        "ad-hoc details"
    );
    assert_internal(&wrong_key, "fetch models: upstream 401: bad key");
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_check_reports_the_upstream_failure_in_its_response() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;
    let base_url = vendor().await?;
    let id = create(&engine, &token, &provider(&base_url)).await?;
    let adhoc = |model: &str| {
        json!({
            "kind": "PROVIDER_KIND_OPENAI",
            "baseUrl": format!("{base_url}/"),
            "apiKey": "sk-1",
            "model": model,
        })
    };

    let stored = engine
        .call_as(&token, CHECK, &json!({ "id": id, "model": " m1 " }))
        .await?;
    let answering = engine.call_as(&token, CHECK, &adhoc("m1")).await?;
    let missing = engine.call_as(&token, CHECK, &adhoc("missing")).await?;

    assert_eq!(
        (stored.status, &stored.body),
        (200, &json!({})),
        "stored provider"
    );
    assert_eq!(
        (answering.status, &answering.body),
        (200, &json!({})),
        "ad-hoc"
    );
    assert_eq!(
        (missing.status, &missing.body),
        (200, &json!({ "error": "upstream 404: model not found" })),
        "missing model"
    );
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn keys_sealed_under_a_rotated_secret_fail_as_internal_errors() -> Result<(), Box<dyn Error>>
{
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;
    let id = create(&engine, &token, &provider("https://api.example.com")).await?;

    engine.reopen_with_secret_key("rotated").await?;
    let fetched = engine.call_as(&token, FETCH, &json!({ "id": id })).await?;

    assert_internal(&fetched, "crypto: decrypt failed");
    engine.close().await?;
    Ok(())
}

#[tokio::test]
async fn a_database_failure_is_an_internal_error() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let token = engine.token("ada").await?;
    engine.close().await?;

    let reply = engine.call_as(&token, LIST, &json!({})).await?;

    assert_internal(&reply, "db: ");
    Ok(())
}
