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
const CREATE: &str = "/lemma.v1.ProviderService/CreateCustomProvider";
const UPDATE: &str = "/lemma.v1.ProviderService/UpdateCustomProvider";
const UPDATE_PREDEFINED: &str = "/lemma.v1.ProviderService/UpdatePredefinedProvider";
const DELETE: &str = "/lemma.v1.ProviderService/DeleteCustomProvider";
const FETCH: &str = "/lemma.v1.ProviderService/FetchModels";
const CHECK: &str = "/lemma.v1.ProviderService/CheckProvider";
const LIST_WEB: &str = "/lemma.v1.ProviderService/ListWebProviders";
const UPDATE_WEB: &str = "/lemma.v1.ProviderService/UpdateWebProvider";
const ORDER_WEB: &str = "/lemma.v1.ProviderService/SetWebProviderOrder";

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
        "apiFormat": "API_FORMAT_OPENAI",
        "identifier": "main",
        "name": "Main",
        "baseUrl": base_url,
        "apiKey": "sk-1",
        "models": [{ "id": "m1", "toolCalling": true }],
        "apiPath": "/chat/completions",
        "modelsPath": "/models",
    })
}

async fn create(engine: &Engine, body: &Value) -> Result<String, Box<dyn Error>> {
    let reply = engine.call(CREATE, body).await?;
    reply.body["provider"]["id"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("no provider id in {reply:?}").into())
}

fn web_id(body: &Value, kind: &str) -> Result<String, Box<dyn Error>> {
    body["providers"]
        .as_array()
        .and_then(|providers| providers.iter().find(|provider| provider["kind"] == kind))
        .and_then(|provider| provider["id"].as_str())
        .map(str::to_owned)
        .ok_or_else(|| format!("no {kind} provider in {body}").into())
}

#[tokio::test]
async fn providers_round_trip_through_create_list_update_and_delete() -> Result<(), Box<dyn Error>>
{
    let mut engine = Engine::open().await?;

    let created = engine
        .call(CREATE, &provider("https://api.example.com/v1/"))
        .await?;
    let id = created.body["provider"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let listed = engine.call(LIST, &json!({})).await?;
    let updated = engine
        .call(
            UPDATE,
            &json!({
                "id": id,
                "name": " Backup ",
                "baseUrl": " https://proxy.example.com/v1/ ",
                "apiPath": " /v2/chat ",
                "modelsPath": " /v2/models ",
                "enabled": false,
                "models": { "models": [{ "id": "m2", "toolCalling": true }] },
            }),
        )
        .await?;
    let deleted = engine.call(DELETE, &json!({ "id": id })).await?;
    let after = engine.call(LIST, &json!({})).await?;
    assert_eq!(
        created.body["provider"],
        json!({
            "id": id,
            "apiKey": "sk-1",
            "enabled": true,
            "custom": {
                "apiFormat": "API_FORMAT_OPENAI",
                "identifier": "main",
                "name": "Main",
                "baseUrl": "https://api.example.com/v1",
                "models": [{ "id": "m1", "toolCalling": true }],
                "apiPath": "/chat/completions",
                "modelsPath": "/models",
            },
        }),
        "created provider"
    );
    assert_eq!(
        listed.body["providers"][1],
        json!(created.body["provider"]),
        "custom provider follows predefined DeepSeek"
    );
    assert_eq!(
        updated.body["provider"],
        json!({
            "id": id,
            "apiKey": "sk-1",
            "custom": {
                "apiFormat": "API_FORMAT_OPENAI",
                "identifier": "main",
                "name": "Backup",
                "baseUrl": "https://proxy.example.com/v1",
                "models": [{ "id": "m2", "toolCalling": true }],
                "apiPath": "/v2/chat",
                "modelsPath": "/v2/models",
            },
        }),
        "updated provider, disabled, its key unchanged"
    );
    assert_eq!(deleted.status, 200, "{deleted:?}");
    assert_eq!(after.body["providers"].as_array().map(Vec::len), Some(1));
    assert_eq!(
        after.body["providers"][0]["predefined"]["identifier"], "deepseek",
        "predefined provider remains: {after:?}"
    );
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn predefined_provider_updates_use_the_dedicated_rpc() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let listed = engine.call(LIST, &json!({})).await?;
    let id = listed.body["providers"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let without_key = engine
        .call(UPDATE_PREDEFINED, &json!({ "id": id, "enabled": true }))
        .await?;
    let updated = engine
        .call(
            UPDATE_PREDEFINED,
            &json!({
                "id": id,
                "apiKey": "sk-deepseek",
                "enabled": true,
                "defaultApiFormat": "API_FORMAT_OPENAI",
            }),
        )
        .await?;
    let invalid = engine
        .call(
            UPDATE_PREDEFINED,
            &json!({ "id": id, "defaultApiFormat": "API_FORMAT_GEMINI" }),
        )
        .await?;
    let fetched = engine.call(FETCH, &json!({ "id": id })).await?;
    let deleted = engine.call(DELETE, &json!({ "id": id })).await?;
    assert_reason(&without_key, ErrorReason::ProviderKeyRequired);
    assert!(
        updated.body["provider"]["enabled"]
            .as_bool()
            .unwrap_or_default()
    );
    assert_eq!(updated.body["provider"]["apiKey"], "sk-deepseek");
    assert_eq!(
        updated.body["provider"]["predefined"]["defaultApiFormat"],
        "API_FORMAT_OPENAI"
    );
    assert_reason(&invalid, ErrorReason::ApiFormatInvalid);
    assert_reason(&fetched, ErrorReason::ProviderNotFound);
    assert_reason(&deleted, ErrorReason::ProviderNotFound);
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn web_providers_round_trip_through_update_and_reorder() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let listed = engine.call(LIST_WEB, &json!({})).await?;
    let native = web_id(&listed.body, "KIND_NATIVE")?;
    let exa = web_id(&listed.body, "KIND_EXA")?;
    let deepseek = web_id(&listed.body, "KIND_DEEPSEEK")?;

    let without_key = engine
        .call(UPDATE_WEB, &json!({ "id": exa, "enabled": true }))
        .await?;
    let exa_enabled = engine
        .call(
            UPDATE_WEB,
            &json!({ "id": exa, "apiKey": "sk-exa", "enabled": true }),
        )
        .await?;
    let deepseek_enabled = engine
        .call(
            UPDATE_WEB,
            &json!({ "id": deepseek, "apiKey": "sk-deepseek", "enabled": true }),
        )
        .await?;
    let search_order = engine
        .call(
            ORDER_WEB,
            &json!({ "function": "FUNCTION_SEARCH", "ids": [deepseek, exa] }),
        )
        .await?;
    let fetch_order = engine
        .call(
            ORDER_WEB,
            &json!({ "function": "FUNCTION_FETCH", "ids": [deepseek, exa, native] }),
        )
        .await?;
    let cleared = engine
        .call(UPDATE_WEB, &json!({ "id": exa, "apiKey": "" }))
        .await?;
    assert_reason(&without_key, ErrorReason::ProviderKeyRequired);
    assert_eq!(listed.body["providers"][0]["kind"], "KIND_NATIVE");
    assert_eq!(listed.body["providers"][0]["name"], "Native");
    assert_eq!(listed.body["providers"][0]["enabled"], true);
    assert_eq!(listed.body["providers"][1]["kind"], "KIND_EXA");
    assert_eq!(listed.body["providers"][2]["kind"], "KIND_DEEPSEEK");
    assert_eq!(exa_enabled.body["provider"]["apiKey"], "sk-exa");
    assert_eq!(deepseek_enabled.body["provider"]["apiKey"], "sk-deepseek");
    let search_exa = search_order.body["providers"]
        .as_array()
        .and_then(|providers| {
            providers
                .iter()
                .find(|provider| provider["kind"] == "KIND_EXA")
        })
        .ok_or("Exa missing from search order")?;
    let search_deepseek = search_order.body["providers"]
        .as_array()
        .and_then(|providers| {
            providers
                .iter()
                .find(|provider| provider["kind"] == "KIND_DEEPSEEK")
        })
        .ok_or("DeepSeek missing from search order")?;
    let fetch_native = fetch_order.body["providers"]
        .as_array()
        .and_then(|providers| {
            providers
                .iter()
                .find(|provider| provider["kind"] == "KIND_NATIVE")
        })
        .ok_or("Native missing from fetch order")?;
    assert_eq!(search_exa["searchRank"], 1);
    assert_eq!(
        search_deepseek["searchRank"].as_i64().unwrap_or_default(),
        0
    );
    assert_eq!(fetch_native["fetchRank"], 2);
    assert!(
        !cleared.body["provider"]["enabled"]
            .as_bool()
            .unwrap_or_default()
    );
    assert!(
        cleared.body["provider"].get("apiKey").is_none(),
        "cleared key omitted"
    );
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn invalid_web_requests_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let listed = engine.call(LIST_WEB, &json!({})).await?;
    let native = web_id(&listed.body, "KIND_NATIVE")?;
    let exa = web_id(&listed.body, "KIND_EXA")?;
    let deepseek = web_id(&listed.body, "KIND_DEEPSEEK")?;
    let unknown = "00000000-0000-4000-8000-000000000000";

    let cases = [
        (
            engine
                .call(UPDATE_WEB, &json!({ "id": "x", "enabled": true }))
                .await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine
                .call(UPDATE_WEB, &json!({ "id": unknown, "enabled": false }))
                .await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine
                .call(ORDER_WEB, &json!({ "function": "FUNCTION_UNSPECIFIED" }))
                .await?,
            ErrorReason::ProviderFieldsRequired,
        ),
        (
            engine
                .call(
                    ORDER_WEB,
                    &json!({ "function": "FUNCTION_SEARCH", "ids": ["x"] }),
                )
                .await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine
                .call(
                    ORDER_WEB,
                    &json!({ "function": "FUNCTION_SEARCH", "ids": [] }),
                )
                .await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine
                .call(
                    ORDER_WEB,
                    &json!({ "function": "FUNCTION_SEARCH", "ids": [exa, exa] }),
                )
                .await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine
                .call(
                    ORDER_WEB,
                    &json!({ "function": "FUNCTION_SEARCH", "ids": [exa, deepseek, native] }),
                )
                .await?,
            ErrorReason::ProviderNotFound,
        ),
    ];

    for (reply, reason) in &cases {
        assert_reason(reply, *reason);
    }
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn each_api_format_maps_to_its_proto_value() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;

    for (index, kind) in [
        "API_FORMAT_OPENAI",
        "API_FORMAT_ANTHROPIC",
        "API_FORMAT_GEMINI",
    ]
    .into_iter()
    .enumerate()
    {
        let mut body = provider("https://api.example.com");
        body["apiFormat"] = json!(kind);
        body["identifier"] = json!(format!("p{index}"));
        let reply = engine.call(CREATE, &body).await?;
        assert_eq!(
            reply.body["provider"]["custom"]["apiFormat"], kind,
            "{reply:?}"
        );
    }
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn invalid_requests_carry_their_reasons() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let _id = create(&engine, &provider("https://api.example.com")).await?;
    let unknown = "00000000-0000-4000-8000-000000000000";
    let mut no_kind = provider("https://api.example.com");
    no_kind["apiFormat"] = json!("API_FORMAT_UNSPECIFIED");
    let mut blank_identifier = provider("https://api.example.com");
    blank_identifier["identifier"] = json!(" ");
    let blank_base_url = provider(" ");

    let cases = [
        (
            engine.call(CREATE, &no_kind).await?,
            ErrorReason::ApiFormatInvalid,
        ),
        (
            engine.call(CREATE, &blank_identifier).await?,
            ErrorReason::ProviderIdentifierInvalid,
        ),
        (
            engine.call(CREATE, &blank_base_url).await?,
            ErrorReason::ProviderFieldsRequired,
        ),
        (
            engine
                .call(CREATE, &provider("https://api.example.com"))
                .await?,
            ErrorReason::ProviderIdentifierTaken,
        ),
        (
            engine
                .call(UPDATE, &json!({ "id": "x", "name": "n" }))
                .await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine
                .call(UPDATE, &json!({ "id": unknown, "name": "n" }))
                .await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine.call(DELETE, &json!({ "id": unknown })).await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine.call(DELETE, &json!({ "id": "x" })).await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine.call(FETCH, &json!({})).await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine.call(FETCH, &json!({ "id": "x" })).await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine.call(FETCH, &json!({ "id": unknown })).await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine
                .call(CHECK, &json!({ "id": unknown, "model": " " }))
                .await?,
            ErrorReason::ModelRequired,
        ),
        (
            engine.call(CHECK, &json!({ "model": "m1" })).await?,
            ErrorReason::IdInvalid,
        ),
        (
            engine
                .call(CHECK, &json!({ "id": unknown, "model": "m1" }))
                .await?,
            ErrorReason::ProviderNotFound,
        ),
        (
            engine
                .call(CHECK, &json!({ "id": "x", "model": "m1" }))
                .await?,
            ErrorReason::IdInvalid,
        ),
    ];

    for (reply, reason) in &cases {
        assert_reason(reply, *reason);
    }
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn models_are_fetched_with_the_stored_key() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let base_url = vendor().await?;
    let id = create(&engine, &provider(&base_url)).await?;
    let mut bad = provider(&base_url);
    bad["identifier"] = json!("bad");
    bad["apiKey"] = json!("sk-2");
    let bad_id = create(&engine, &bad).await?;

    let stored = engine.call(FETCH, &json!({ "id": id })).await?;
    let wrong_key = engine.call(FETCH, &json!({ "id": bad_id })).await?;

    assert_eq!(
        stored.body,
        json!({ "models": ["m1", "m2"] }),
        "stored provider"
    );
    assert_internal(&wrong_key, "fetch models: upstream 401: bad key");
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_check_reports_the_upstream_failure_in_its_response() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    let base_url = vendor().await?;
    let id = create(&engine, &provider(&base_url)).await?;

    let answering = engine
        .call(CHECK, &json!({ "id": id, "model": " m1 " }))
        .await?;
    let missing = engine
        .call(CHECK, &json!({ "id": id, "model": "missing" }))
        .await?;

    assert_eq!(
        (answering.status, &answering.body),
        (200, &json!({})),
        "stored provider answers"
    );
    assert_eq!(
        (missing.status, &missing.body),
        (200, &json!({ "error": "upstream 404: model not found" })),
        "missing model"
    );
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn keys_sealed_under_a_rotated_secret_fail_as_internal_errors() -> Result<(), Box<dyn Error>>
{
    let mut engine = Engine::open().await?;
    let id = create(&engine, &provider("https://api.example.com")).await?;

    engine.reopen_with_secret_key("rotated").await?;
    let fetched = engine.call(FETCH, &json!({ "id": id })).await?;

    assert_internal(&fetched, "crypto: decrypt failed");
    engine.close().await;
    Ok(())
}

#[tokio::test]
async fn a_database_failure_is_an_internal_error() -> Result<(), Box<dyn Error>> {
    let mut engine = Engine::open().await?;
    engine.close().await;

    let reply = engine.call(LIST, &json!({})).await?;

    assert_internal(&reply, "db: ");
    Ok(())
}
