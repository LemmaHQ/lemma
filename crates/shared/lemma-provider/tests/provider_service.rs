//! Provider flows against a migrated database.

use std::error::Error;

use sqlx::SqlitePool;
use uuid::Uuid;

use lemma_crypto::CryptoError;
use lemma_model::{
    Adapter, ApiFormat, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest,
};
use lemma_provider::{
    CreateCustomInput, CustomProviderView, PredefinedProviderView, ProviderError, ProviderModel,
    ProviderService, ProviderView, UpdateCustomInput, UpdatePredefinedInput,
};

#[derive(Debug)]
struct BoundEndpoint(Endpoint);

impl Adapter for BoundEndpoint {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        Err(ModelError::new(format!(
            "refused at {} with {}",
            self.0.base_url, self.0.api_key
        )))
    }
}

#[derive(Debug)]
struct EndpointConnector;

impl Connector for EndpointConnector {
    type Adapter = BoundEndpoint;

    fn connect(&self, endpoint: Endpoint) -> BoundEndpoint {
        BoundEndpoint(endpoint)
    }

    async fn list_models(&self, endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        if endpoint.base_url.contains("unreachable") {
            return Err(ModelError::new("connection refused".to_owned()));
        }
        let api_format = match endpoint.api_format {
            ApiFormat::OpenAiCompatible => "openai",
            ApiFormat::Anthropic => "anthropic",
            ApiFormat::Gemini => "gemini",
        };
        Ok(vec![
            api_format.to_owned(),
            endpoint.base_url,
            endpoint.models_path,
            endpoint.api_key,
        ])
    }
}

fn service(db: SqlitePool) -> ProviderService<EndpointConnector> {
    ProviderService::new(db, "test-secret-key", EndpointConnector)
}

fn models(ids: &[&str]) -> Vec<ProviderModel> {
    ids.iter()
        .map(|id| ProviderModel {
            id: (*id).to_owned(),
            tool_calling: true,
        })
        .collect()
}

fn custom_views(views: &[ProviderView]) -> Vec<&CustomProviderView> {
    views
        .iter()
        .filter_map(|view| match view {
            ProviderView::Custom(custom) => Some(custom),
            ProviderView::Predefined(_) => None,
        })
        .collect()
}

fn deepseek(views: &[ProviderView]) -> Option<&PredefinedProviderView> {
    views.iter().find_map(|view| match view {
        ProviderView::Predefined(predefined) if predefined.identifier == "deepseek" => {
            Some(predefined)
        }
        _ => None,
    })
}

fn new_provider(identifier: &str) -> CreateCustomInput {
    CreateCustomInput {
        api_format: ApiFormat::OpenAiCompatible,
        identifier: identifier.to_owned(),
        name: "Main".to_owned(),
        base_url: "https://api.example.com/v1/".to_owned(),
        api_key: "sk-original".to_owned(),
        api_path: "/chat".to_owned(),
        models_path: "/models".to_owned(),
        models: models(&["model-a"]),
    }
}

#[tokio::test]
async fn an_identifier_is_unique_among_custom_providers() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    providers.create_custom(new_provider("main")).await?;

    let duplicate = providers.create_custom(new_provider("main")).await;
    let other_identifier = providers.create_custom(new_provider("backup")).await;

    assert!(
        matches!(duplicate, Err(ProviderError::IdentifierTaken)),
        "duplicate custom identifier: {duplicate:?}"
    );
    assert!(
        other_identifier.is_ok(),
        "other identifier: {other_identifier:?}"
    );
    Ok(())
}

#[tokio::test]
async fn update_changes_only_the_given_fields() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let before = providers.create_custom(new_provider("main")).await?;

    let toggled = providers
        .update_custom(
            before.id,
            UpdateCustomInput {
                enabled: Some(false),
                models: Some(models(&["model-b"])),
                ..Default::default()
            },
        )
        .await?;
    let rekeyed = providers
        .update_custom(
            before.id,
            UpdateCustomInput {
                api_key: Some("sk-replaced".to_owned()),
                ..Default::default()
            },
        )
        .await?;
    let renamed = providers
        .update_custom(
            before.id,
            UpdateCustomInput {
                name: Some("  Primary  ".to_owned()),
                base_url: Some(" https://next.example.com/v2/ ".to_owned()),
                api_path: Some(" /v2/chat ".to_owned()),
                models_path: Some(" /v2/models ".to_owned()),
                ..Default::default()
            },
        )
        .await?;
    let untouched = providers
        .update_custom(before.id, UpdateCustomInput::default())
        .await?;
    let missing = providers
        .update_custom(Uuid::new_v4(), UpdateCustomInput::default())
        .await;
    let bound = providers.bind(before.id, "model-b", None).await?.adapter;

    assert!(!toggled.enabled, "enabled flag");
    assert_eq!(toggled.models, models(&["model-b"]), "model list");
    assert_eq!(toggled.name, before.name, "name");
    assert_eq!(toggled.base_url, before.base_url, "base URL");
    assert!(toggled.has_key, "has_key preserved");
    assert_eq!(toggled.api_path, before.api_path, "generation path");
    assert_eq!(toggled.models_path, before.models_path, "model-list path");
    assert!(rekeyed.has_key, "replaced api key remains present");
    assert!(!rekeyed.enabled, "enabled flag after the key change");
    assert_eq!(
        rekeyed.models,
        models(&["model-b"]),
        "model list after the key change"
    );
    assert_eq!(bound.0.api_key, "sk-replaced", "key the adapter opens");
    assert_eq!(renamed.name, "Primary", "trimmed updated name");
    assert_eq!(
        renamed.base_url, "https://next.example.com/v2",
        "trimmed updated base URL"
    );
    assert_eq!(renamed.api_path, "/v2/chat", "trimmed updated api path");
    assert_eq!(
        renamed.models_path, "/v2/models",
        "trimmed updated models path"
    );
    assert!(
        untouched.has_key,
        "an empty update returns the stored provider"
    );
    assert!(
        matches!(missing, Err(ProviderError::NotFound)),
        "updating a missing provider: {missing:?}"
    );
    Ok(())
}

#[tokio::test]
async fn delete_removes_only_the_target_custom_provider() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let doomed = providers.create_custom(new_provider("main")).await?;
    let kept = providers.create_custom(new_provider("backup")).await?;

    providers.delete_custom(doomed.id).await?;
    let again = providers.delete_custom(doomed.id).await;
    let listed = providers.list().await?;

    let remaining = custom_views(&listed);
    assert!(
        matches!(again, Err(ProviderError::NotFound)),
        "second delete: {again:?}"
    );
    assert_eq!(remaining.len(), 1, "remaining custom providers");
    assert_eq!(remaining[0].id, kept.id, "kept provider survives");
    Ok(())
}

#[tokio::test]
async fn create_requires_an_ascii_identifier_and_a_base_url() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);

    let blank = providers.create_custom(new_provider("  ")).await;
    let non_ascii = providers.create_custom(new_provider("主要")).await;
    let no_base_url = providers
        .create_custom(CreateCustomInput {
            base_url: " / ".to_owned(),
            ..new_provider("main")
        })
        .await;

    assert!(
        matches!(blank, Err(ProviderError::IdentifierInvalid)),
        "blank identifier: {blank:?}"
    );
    assert!(
        matches!(non_ascii, Err(ProviderError::IdentifierInvalid)),
        "non-ASCII identifier: {non_ascii:?}"
    );
    assert!(
        matches!(no_base_url, Err(ProviderError::FieldsRequired)),
        "blank base URL: {no_base_url:?}"
    );
    assert!(
        custom_views(&providers.list().await?).is_empty(),
        "no custom provider was created"
    );
    Ok(())
}

#[tokio::test]
async fn a_provider_without_a_key_or_name_keeps_them_empty_and_named_by_identifier()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);

    let created = providers
        .create_custom(CreateCustomInput {
            name: " ".to_owned(),
            api_key: String::new(),
            ..new_provider(" local ")
        })
        .await?;
    let bound = providers.bind(created.id, "model-a", None).await?.adapter;

    assert_eq!(
        (created.identifier.as_str(), created.name.as_str()),
        ("local", "local"),
        "identifier and name"
    );
    assert!(!created.has_key, "view has_key is false when empty");
    assert_eq!(bound.0.api_key, "", "key the adapter sends");
    Ok(())
}

#[tokio::test]
async fn the_adapter_is_bound_to_the_stored_connection_details() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let created = providers
        .create_custom(CreateCustomInput {
            api_format: ApiFormat::Anthropic,
            ..new_provider("main")
        })
        .await?;

    let bound = providers.bind(created.id, "model-a", None).await?.adapter;

    assert_eq!(bound.0.api_format, ApiFormat::Anthropic, "API format");
    assert_eq!(bound.0.base_url, "https://api.example.com/v1", "base URL");
    assert_eq!(bound.0.api_key, "sk-original", "opened key");
    assert_eq!(
        (bound.0.api_path.as_str(), bound.0.models_path.as_str()),
        ("/chat", "/models"),
        "paths"
    );
    Ok(())
}

#[tokio::test]
async fn live_models_and_checks_use_the_stored_details() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let created = providers.create_custom(new_provider("main")).await?;
    let down = providers
        .create_custom(CreateCustomInput {
            base_url: "https://unreachable.example/".to_owned(),
            ..new_provider("down")
        })
        .await?;

    let stored = providers.fetch_models(created.id).await?;
    let unreachable = providers.fetch_models(down.id).await;
    let missing_models = providers.fetch_models(Uuid::new_v4()).await;
    let checked = providers.check(created.id, " model-a ").await;
    let missing_check = providers.check(Uuid::new_v4(), "model-a").await;

    assert_eq!(
        stored,
        [
            "openai",
            "https://api.example.com/v1",
            "/models",
            "sk-original"
        ],
        "stored details"
    );
    assert!(
        matches!(&unreachable, Err(ProviderError::Fetch(m)) if m == "connection refused"),
        "failed fetch: {unreachable:?}"
    );
    assert!(
        matches!(missing_models, Err(ProviderError::NotFound)),
        "missing provider models: {missing_models:?}"
    );
    assert!(
        matches!(&checked, Err(ProviderError::Check(m))
            if m == "refused at https://api.example.com/v1 with sk-original"),
        "check against the stored endpoint: {checked:?}"
    );
    assert!(
        matches!(missing_check, Err(ProviderError::NotFound)),
        "missing provider check: {missing_check:?}"
    );
    Ok(())
}

#[tokio::test]
async fn a_key_sealed_under_another_secret_or_corrupted_cannot_be_opened()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let created = service(db.clone())
        .create_custom(new_provider("main"))
        .await?;
    let rotated = ProviderService::new(db.clone(), "rotated", EndpointConnector);

    let with_rotated_secret = rotated.bind(created.id, "model-a", None).await;
    let listed = rotated.list().await?;
    sqlx::query("UPDATE providers SET api_key = 'not sealed'")
        .execute(&db)
        .await?;
    let corrupted = service(db).bind(created.id, "model-a", None).await;

    assert!(
        matches!(
            &with_rotated_secret,
            Err(ProviderError::Crypto(CryptoError::Decrypt))
        ),
        "rotated secret: {with_rotated_secret:?}"
    );
    assert_eq!(
        custom_views(&listed)
            .iter()
            .map(|provider| provider.has_key)
            .collect::<Vec<_>>(),
        [true],
        "list reports stored ciphertext presence without opening it"
    );
    assert!(
        matches!(
            &corrupted,
            Err(ProviderError::Crypto(CryptoError::Encoding))
        ),
        "corrupted key: {corrupted:?}"
    );
    Ok(())
}

#[tokio::test]
async fn debug_output_never_reveals_the_sealing_secret() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let debug = format!("{:?}", service(db));

    assert!(
        debug.starts_with("ProviderService") && !debug.contains("test-secret-key"),
        "{debug}"
    );
    Ok(())
}

#[tokio::test]
async fn provider_methods_report_database_failures() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db.clone());
    let created = providers.create_custom(new_provider("main")).await?;

    sqlx::query("DROP TABLE providers").execute(&db).await?;
    let listed = providers.list().await;
    let inserted = providers.create_custom(new_provider("main")).await;
    let disabled = UpdateCustomInput {
        enabled: Some(false),
        ..Default::default()
    };
    let updated = providers.update_custom(created.id, disabled).await;
    let empty_updated = providers
        .update_custom(created.id, UpdateCustomInput::default())
        .await;
    let predefined_updated = providers
        .update_predefined(created.id, UpdatePredefinedInput::default())
        .await;
    let adapted = providers.bind(created.id, "model-a", None).await;
    let fetched = providers.fetch_models(created.id).await;
    let checked = providers.check(created.id, "model-a").await;
    let deleted = providers.delete_custom(created.id).await;

    for (operation, failed) in [
        ("list", listed.err()),
        ("create", inserted.err()),
        ("update", updated.err()),
        ("empty update", empty_updated.err()),
        ("predefined update", predefined_updated.err()),
        ("adapter", adapted.err()),
        ("fetch models", fetched.err()),
        ("check", checked.err()),
        ("delete", deleted.err()),
    ] {
        assert!(
            matches!(failed, Some(ProviderError::Store(_))),
            "{operation} without tables: {failed:?}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn list_inserts_deepseek_once_beside_a_custom_deepseek() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let custom = providers.create_custom(new_provider("deepseek")).await?;

    let first = providers.list().await?;
    let second = providers.list().await?;

    assert_eq!(first.len(), 2, "one predefined and one custom: {first:?}");
    assert_eq!(second, first, "idempotent list");
    let deepseek = deepseek(&first).ok_or("DeepSeek missing")?;
    assert_eq!(deepseek.name, "DeepSeek", "catalog name");
    assert!(!deepseek.enabled, "initially disabled");
    assert_eq!(deepseek.default_api_format, ApiFormat::Anthropic, "default");
    assert_eq!(
        deepseek.api_formats,
        [ApiFormat::Anthropic, ApiFormat::OpenAiCompatible],
        "served formats"
    );
    assert_eq!(
        deepseek.models,
        models(&["deepseek-flash", "deepseek-v4-pro"]),
        "catalog models"
    );
    assert_eq!(custom_views(&first)[0].id, custom.id, "custom coexistence");
    Ok(())
}

#[tokio::test]
async fn predefined_updates_validate_keys_formats_and_source() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let listed = providers.list().await?;
    let id = deepseek(&listed).ok_or("DeepSeek missing")?.id;
    let unchanged = providers
        .update_predefined(id, UpdatePredefinedInput::default())
        .await?;

    let enable_without_key = providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                enabled: Some(true),
                ..Default::default()
            },
        )
        .await;
    let invalid_default = providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                default_api_format: Some(ApiFormat::Gemini),
                ..Default::default()
            },
        )
        .await;
    let enabled = providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                api_key: Some("sk-deepseek".to_owned()),
                enabled: Some(true),
                default_api_format: Some(ApiFormat::OpenAiCompatible),
            },
        )
        .await?;
    let clear_while_enabled = providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                api_key: Some(String::new()),
                ..Default::default()
            },
        )
        .await;
    let format_only = providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                default_api_format: Some(ApiFormat::Anthropic),
                ..Default::default()
            },
        )
        .await?;
    let custom_update = providers
        .update_custom(id, UpdateCustomInput::default())
        .await;
    let custom_delete = providers.delete_custom(id).await;
    let custom_fetch = providers.fetch_models(id).await;
    let custom = providers.create_custom(new_provider("main")).await?;
    let predefined_update = providers
        .update_predefined(custom.id, UpdatePredefinedInput::default())
        .await;

    assert_eq!(
        unchanged.default_api_format,
        ApiFormat::Anthropic,
        "empty patch"
    );
    assert!(
        matches!(enable_without_key, Err(ProviderError::KeyRequired)),
        "enable without key: {enable_without_key:?}"
    );
    assert!(
        matches!(invalid_default, Err(ProviderError::ApiFormatInvalid)),
        "invalid format: {invalid_default:?}"
    );
    assert!(enabled.enabled, "enabled with a saved key");
    assert!(enabled.has_key, "saved key reported");
    assert_eq!(
        enabled.default_api_format,
        ApiFormat::OpenAiCompatible,
        "updated format"
    );
    assert!(
        matches!(clear_while_enabled, Err(ProviderError::KeyRequired)),
        "clear while enabled: {clear_while_enabled:?}"
    );
    assert_eq!(
        format_only.default_api_format,
        ApiFormat::Anthropic,
        "format only update"
    );
    assert!(format_only.has_key, "key retained");
    for (operation, result) in [
        ("custom update", custom_update.err()),
        ("custom delete", custom_delete.err()),
        ("custom fetch", custom_fetch.err()),
        ("predefined update", predefined_update.err()),
    ] {
        assert!(
            matches!(result, Some(ProviderError::NotFound)),
            "{operation}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn binding_resolves_format_and_tool_calling() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let custom = providers
        .create_custom(CreateCustomInput {
            api_format: ApiFormat::Anthropic,
            models: vec![ProviderModel {
                id: "model-a".to_owned(),
                tool_calling: false,
            }],
            ..new_provider("main")
        })
        .await?;
    let custom_binding = providers
        .bind(custom.id, "model-a", Some(ApiFormat::OpenAiCompatible))
        .await?;
    let absent_custom = providers
        .bind(custom.id, "absent", Some(ApiFormat::Gemini))
        .await?;
    let missing_bind = providers.bind(Uuid::new_v4(), "model-a", None).await;
    let listed = providers.list().await?;
    let deepseek = deepseek(&listed).ok_or("DeepSeek missing")?;
    let followed = providers
        .bind(
            deepseek.id,
            "deepseek-flash",
            Some(ApiFormat::OpenAiCompatible),
        )
        .await?;
    let fallback = providers
        .bind(deepseek.id, "deepseek-flash", Some(ApiFormat::Gemini))
        .await?;
    let absent_predefined = providers.bind(deepseek.id, "absent", None).await?;

    assert_eq!(
        custom_binding.adapter.0.api_format,
        ApiFormat::Anthropic,
        "bound adapter format"
    );
    assert_eq!(
        custom_binding.api_format,
        ApiFormat::Anthropic,
        "custom format"
    );
    assert!(!custom_binding.tool_calling, "configured tool calling");
    assert!(
        absent_custom.tool_calling,
        "absent custom model defaults to tools"
    );
    assert!(
        matches!(missing_bind, Err(ProviderError::NotFound)),
        "binding missing provider: {missing_bind:?}"
    );
    assert_eq!(
        followed.api_format,
        ApiFormat::OpenAiCompatible,
        "previous served format"
    );
    assert_eq!(
        fallback.api_format,
        ApiFormat::Anthropic,
        "unserved previous format"
    );
    assert_eq!(
        fallback.adapter.0.base_url, "https://api.deepseek.com/anthropic",
        "default endpoint"
    );
    assert!(
        fallback.tool_calling && absent_predefined.tool_calling,
        "predefined model features"
    );
    Ok(())
}

#[tokio::test]
async fn predefined_check_uses_its_default_format_endpoint() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let listed = providers.list().await?;
    let id = deepseek(&listed).ok_or("DeepSeek missing")?.id;
    providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                api_key: Some("sk-deepseek".to_owned()),
                default_api_format: Some(ApiFormat::OpenAiCompatible),
                ..Default::default()
            },
        )
        .await?;

    let checked = providers.check(id, "deepseek-flash").await;

    assert!(
        matches!(&checked, Err(ProviderError::Check(message))
            if message == "refused at https://api.deepseek.com with sk-deepseek"),
        "default OpenAI endpoint: {checked:?}"
    );
    Ok(())
}

#[tokio::test]
async fn concurrent_enable_and_key_clear_never_enable_without_a_key() -> Result<(), Box<dyn Error>>
{
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let listed = providers.list().await?;
    let id = deepseek(&listed).ok_or("DeepSeek missing")?.id;
    providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                api_key: Some("sk-deepseek".to_owned()),
                ..Default::default()
            },
        )
        .await?;

    let enable = providers.update_predefined(
        id,
        UpdatePredefinedInput {
            enabled: Some(true),
            ..Default::default()
        },
    );
    let clear = providers.update_predefined(
        id,
        UpdatePredefinedInput {
            api_key: Some(String::new()),
            ..Default::default()
        },
    );
    let (enabled, cleared) = tokio::join!(enable, clear);

    let listed = providers.list().await?;
    let after = deepseek(&listed).ok_or("DeepSeek missing")?;
    assert!(
        !after.enabled || after.has_key,
        "enabled={} has_key={} enable={enabled:?} clear={cleared:?}",
        after.enabled,
        after.has_key
    );

    if after.enabled {
        providers
            .update_predefined(
                id,
                UpdatePredefinedInput {
                    enabled: Some(false),
                    ..Default::default()
                },
            )
            .await?;
    }
    let cleared = providers
        .update_predefined(
            id,
            UpdatePredefinedInput {
                api_key: Some(String::new()),
                ..Default::default()
            },
        )
        .await?;
    assert!(!cleared.enabled, "clearing the key disables the provider");
    assert!(!cleared.has_key, "key cleared");
    Ok(())
}
