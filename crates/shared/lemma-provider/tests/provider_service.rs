//! Provider flows against a migrated database.

use std::error::Error;

use lemma_auth::AuthService;
use lemma_crypto::CryptoError;
use lemma_model::{
    Adapter, ApiFormat, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest,
};
use lemma_provider::{
    CreateCustomInput, CustomProviderView, PredefinedProviderView, ProviderError, ProviderModel,
    ProviderService, ProviderView, UpdateCustomInput, UpdatePredefinedInput,
};
use lemma_test_db::on_each_database;
use sea_orm::{ActiveEnum, ConnectionTrait, DatabaseConnection};
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use uuid::Uuid;

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all = lemma_auth::migrations();
        all.extend(lemma_provider::migrations());
        all
    }
}

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
        Ok(vec![
            endpoint.api_format.into_value(),
            endpoint.base_url,
            endpoint.models_path,
            endpoint.api_key,
        ])
    }
}

async fn sign_up(db: &DatabaseConnection, username: &str) -> Result<Uuid, Box<dyn Error>> {
    let signed_in = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up(
            username,
            &format!("{username}@example.com"),
            "correct-horse",
        )
        .await?;
    Ok(signed_in.user.id)
}

fn service(db: DatabaseConnection) -> ProviderService<EndpointConnector> {
    ProviderService::new(db, "test-secret-key".to_owned(), EndpointConnector)
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
async fn a_user_cannot_see_or_change_another_users_provider() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);
        let created = providers.create_custom(ada, new_provider("main")).await?;

        let listed = providers.list(bob).await?;
        let adapter = providers.bind(bob, created.id, "model-a", None).await;
        let updated = providers
            .update_custom(
                bob,
                created.id,
                UpdateCustomInput {
                    name: Some("Hijacked".to_owned()),
                    ..Default::default()
                },
            )
            .await;
        let read_through_update = providers
            .update_custom(bob, created.id, UpdateCustomInput::default())
            .await;
        let missing = providers
            .update_custom(bob, Uuid::new_v4(), UpdateCustomInput::default())
            .await;
        let own = providers.list(ada).await?;

        let own_custom = custom_views(&own);
        assert!(custom_views(&listed).is_empty(), "bob's custom providers");
        assert!(
            matches!(adapter, Err(ProviderError::NotFound)),
            "bob's adapter"
        );
        assert!(
            matches!(updated, Err(ProviderError::NotFound)),
            "bob's update: {updated:?}"
        );
        assert!(
            matches!(read_through_update, Err(ProviderError::NotFound)),
            "bob's empty update: {read_through_update:?}"
        );
        assert!(
            matches!(missing, Err(ProviderError::NotFound)),
            "empty update of a missing provider: {missing:?}"
        );
        assert_eq!(own_custom.len(), 1, "ada's custom providers");
        assert_eq!(
            own_custom[0].name, "Main",
            "ada's name survives bob's update"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn an_identifier_is_unique_per_user() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);
        providers.create_custom(ada, new_provider("main")).await?;

        let duplicate = providers.create_custom(ada, new_provider("main")).await;
        let other_identifier = providers.create_custom(ada, new_provider("backup")).await;
        let other_user = providers.create_custom(bob, new_provider("main")).await;

        assert!(
            matches!(duplicate, Err(ProviderError::IdentifierTaken)),
            "same user, same identifier: {duplicate:?}"
        );
        assert!(
            other_identifier.is_ok(),
            "same user, other identifier: {other_identifier:?}"
        );
        assert!(
            other_user.is_ok(),
            "other user, same identifier: {other_user:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn update_changes_only_the_given_fields() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let before = providers.create_custom(ada, new_provider("main")).await?;

        let toggled = providers
            .update_custom(
                ada,
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
                ada,
                before.id,
                UpdateCustomInput {
                    api_key: Some("sk-replaced".to_owned()),
                    ..Default::default()
                },
            )
            .await?;
        let untouched = providers
            .update_custom(ada, before.id, UpdateCustomInput::default())
            .await?;
        let bound = providers
            .bind(ada, before.id, "model-b", None)
            .await?
            .adapter;

        assert!(!toggled.enabled, "enabled flag");
        assert_eq!(toggled.models, models(&["model-b"]), "model list");
        assert_eq!(toggled.name, before.name, "name");
        assert_eq!(toggled.base_url, before.base_url, "base URL");
        assert_eq!(toggled.api_key, "sk-original", "api key");
        assert_eq!(toggled.api_path, before.api_path, "generation path");
        assert_eq!(toggled.models_path, before.models_path, "model-list path");
        assert_eq!(rekeyed.api_key, "sk-replaced", "replaced api key");
        assert!(!rekeyed.enabled, "enabled flag after the key change");
        assert_eq!(
            rekeyed.models,
            models(&["model-b"]),
            "model list after the key change"
        );
        assert_eq!(bound.0.api_key, "sk-replaced", "key the adapter opens");
        assert_eq!(
            untouched.api_key, "sk-replaced",
            "an empty update returns the stored provider"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn delete_removes_only_the_owners_provider() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);
        let mine = providers.create_custom(ada, new_provider("main")).await?;
        let theirs = providers.create_custom(bob, new_provider("main")).await?;

        let foreign = providers.delete_custom(bob, mine.id).await;
        let survivors = providers.list(ada).await?;
        providers.delete_custom(ada, mine.id).await?;
        let again = providers.delete_custom(ada, mine.id).await;
        let ada_after = providers.list(ada).await?;
        let bob_after = providers.list(bob).await?;

        assert!(
            matches!(foreign, Err(ProviderError::NotFound)),
            "bob deleting ada's provider: {foreign:?}"
        );
        let survivor_custom = custom_views(&survivors);
        let ada_custom = custom_views(&ada_after);
        let bob_custom = custom_views(&bob_after);
        assert_eq!(survivor_custom.len(), 1, "ada's custom providers");
        assert!(
            matches!(again, Err(ProviderError::NotFound)),
            "second delete: {again:?}"
        );
        assert!(ada_custom.is_empty(), "ada's custom providers");
        assert_eq!(bob_custom.len(), 1, "bob's custom providers");
        assert_eq!(bob_custom[0].id, theirs.id, "bob's provider");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn create_requires_an_ascii_identifier_and_a_base_url() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);

        let blank = providers.create_custom(ada, new_provider("  ")).await;
        let non_ascii = providers.create_custom(ada, new_provider("主要")).await;
        let no_base_url = providers
            .create_custom(
                ada,
                CreateCustomInput {
                    base_url: " / ".to_owned(),
                    ..new_provider("main")
                },
            )
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
            custom_views(&providers.list(ada).await?).is_empty(),
            "no custom provider was created"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_provider_without_a_key_or_name_keeps_them_empty_and_named_by_identifier()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);

        let created = providers
            .create_custom(
                ada,
                CreateCustomInput {
                    name: " ".to_owned(),
                    api_key: String::new(),
                    ..new_provider(" local ")
                },
            )
            .await?;
        let bound = providers
            .bind(ada, created.id, "model-a", None)
            .await?
            .adapter;

        assert_eq!(
            (created.identifier.as_str(), created.name.as_str()),
            ("local", "local"),
            "identifier and name"
        );
        assert_eq!(created.api_key, "", "view key");
        assert_eq!(bound.0.api_key, "", "key the adapter sends");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_adapter_is_bound_to_the_stored_connection_details() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let created = providers
            .create_custom(
                ada,
                CreateCustomInput {
                    api_format: ApiFormat::Anthropic,
                    ..new_provider("main")
                },
            )
            .await?;

        let bound = providers
            .bind(ada, created.id, "model-a", None)
            .await?
            .adapter;

        assert_eq!(bound.0.api_format, ApiFormat::Anthropic, "API format");
        assert_eq!(bound.0.base_url, "https://api.example.com/v1", "base URL");
        assert_eq!(bound.0.api_key, "sk-original", "opened key");
        assert_eq!(
            (bound.0.api_path.as_str(), bound.0.models_path.as_str()),
            ("/chat", "/models"),
            "paths"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn live_models_and_checks_use_the_stored_or_given_details() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);
        let created = providers.create_custom(ada, new_provider("main")).await?;

        let stored = providers.fetch_models_for(ada, created.id).await?;
        let adhoc = providers
            .fetch_models_adhoc(
                ApiFormat::Gemini,
                " https://gemini.example.com/ ",
                "g-key",
                " /v1/models ",
            )
            .await?;
        let unreachable = providers
            .fetch_models_adhoc(ApiFormat::Gemini, "https://unreachable.example", "", "")
            .await;
        let foreign = providers.fetch_models_for(bob, created.id).await;
        let checked = providers.check_for(ada, created.id, "model-a").await;
        let foreign_check = providers.check_for(bob, created.id, "model-a").await;

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
        assert_eq!(
            adhoc,
            [
                "gemini",
                "https://gemini.example.com",
                "/v1/models",
                "g-key"
            ],
            "trimmed ad-hoc details"
        );
        assert!(
            matches!(&unreachable, Err(ProviderError::Fetch(m)) if m == "connection refused"),
            "failed fetch: {unreachable:?}"
        );
        assert!(
            matches!(foreign, Err(ProviderError::NotFound)),
            "bob fetching ada's models: {foreign:?}"
        );
        assert!(
            matches!(&checked, Err(ProviderError::Check(m))
                if m == "refused at https://api.example.com/v1 with sk-original"),
            "check against the stored endpoint: {checked:?}"
        );
        assert!(
            matches!(foreign_check, Err(ProviderError::NotFound)),
            "bob checking ada's provider: {foreign_check:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_key_sealed_under_another_secret_or_corrupted_cannot_be_opened()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let created = service(db.clone())
            .create_custom(ada, new_provider("main"))
            .await?;
        let rotated = ProviderService::new(db.clone(), "rotated".to_owned(), EndpointConnector);

        let with_rotated_secret = rotated.bind(ada, created.id, "model-a", None).await;
        let listed = rotated.list(ada).await?;
        db.execute_unprepared("UPDATE providers SET api_key = 'not sealed'")
            .await?;
        let corrupted = service(db).bind(ada, created.id, "model-a", None).await;

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
                .map(|provider| provider.api_key.as_str())
                .collect::<Vec<_>>(),
            [""],
            "an unreadable key lists as empty"
        );
        assert!(
            matches!(
                &corrupted,
                Err(ProviderError::Crypto(CryptoError::Encoding))
            ),
            "corrupted key: {corrupted:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn debug_output_never_reveals_the_sealing_secret() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let debug = format!("{:?}", service(db));

        assert!(
            debug.starts_with("ProviderService") && !debug.contains("test-secret-key"),
            "{debug}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn the_providers_table_rolls_back_and_reapplies() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db.clone());
        let created = providers.create_custom(ada, new_provider("main")).await?;

        Migrator::down(&db, None).await?;
        let listed = providers.list(ada).await;
        let inserted = providers.create_custom(ada, new_provider("main")).await;
        let disabled = UpdateCustomInput {
            enabled: Some(false),
            ..Default::default()
        };
        let updated = providers.update_custom(ada, created.id, disabled).await;
        let empty_updated = providers
            .update_custom(ada, created.id, UpdateCustomInput::default())
            .await;
        let adapted = providers.bind(ada, created.id, "model-a", None).await;
        let fetched = providers.fetch_models_for(ada, created.id).await;
        let checked = providers.check_for(ada, created.id, "model-a").await;
        let deleted = providers.delete_custom(ada, created.id).await;
        Migrator::up(&db, None).await?;

        for (operation, failed) in [
            ("list", listed.err()),
            ("create", inserted.err()),
            ("update", updated.err()),
            ("empty update", empty_updated.err()),
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
        let ada = sign_up(&db, "ada").await?;
        assert!(
            custom_views(&providers.list(ada).await?).is_empty(),
            "rolled back custom rows are gone"
        );
        providers.create_custom(ada, new_provider("main")).await?;
        Ok(())
    })
    .await
}

#[tokio::test]
async fn list_inserts_deepseek_once_beside_a_custom_deepseek() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let custom = providers
            .create_custom(ada, new_provider("deepseek"))
            .await?;

        let first = providers.list(ada).await?;
        let second = providers.list(ada).await?;

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
    })
    .await
}

#[tokio::test]
async fn predefined_updates_validate_keys_formats_and_source() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let listed = providers.list(ada).await?;
        let id = deepseek(&listed).ok_or("DeepSeek missing")?.id;
        let unchanged = providers
            .update_predefined(ada, id, UpdatePredefinedInput::default())
            .await?;

        let enable_without_key = providers
            .update_predefined(
                ada,
                id,
                UpdatePredefinedInput {
                    enabled: Some(true),
                    ..Default::default()
                },
            )
            .await;
        let invalid_default = providers
            .update_predefined(
                ada,
                id,
                UpdatePredefinedInput {
                    default_api_format: Some(ApiFormat::Gemini),
                    ..Default::default()
                },
            )
            .await;
        let enabled = providers
            .update_predefined(
                ada,
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
                ada,
                id,
                UpdatePredefinedInput {
                    api_key: Some(String::new()),
                    ..Default::default()
                },
            )
            .await;
        let format_only = providers
            .update_predefined(
                ada,
                id,
                UpdatePredefinedInput {
                    default_api_format: Some(ApiFormat::Anthropic),
                    ..Default::default()
                },
            )
            .await?;
        let custom_update = providers
            .update_custom(ada, id, UpdateCustomInput::default())
            .await;
        let custom_delete = providers.delete_custom(ada, id).await;
        let custom_fetch = providers.fetch_models_for(ada, id).await;
        let custom = providers.create_custom(ada, new_provider("main")).await?;
        let predefined_update = providers
            .update_predefined(ada, custom.id, UpdatePredefinedInput::default())
            .await;

        assert_eq!(
            unchanged.default_api_format,
            ApiFormat::Anthropic,
            "empty patch"
        );
        assert!(matches!(
            enable_without_key,
            Err(ProviderError::KeyRequired)
        ));
        assert!(matches!(
            invalid_default,
            Err(ProviderError::ApiFormatInvalid)
        ));
        assert!(enabled.enabled, "enabled with a saved key");
        assert_eq!(enabled.api_key, "sk-deepseek", "opened key");
        assert_eq!(enabled.default_api_format, ApiFormat::OpenAiCompatible);
        assert!(matches!(
            clear_while_enabled,
            Err(ProviderError::KeyRequired)
        ));
        assert_eq!(format_only.default_api_format, ApiFormat::Anthropic);
        assert_eq!(format_only.api_key, "sk-deepseek", "key retained");
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
    })
    .await
}

#[tokio::test]
async fn binding_resolves_format_and_tool_calling() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let custom = providers
            .create_custom(
                ada,
                CreateCustomInput {
                    api_format: ApiFormat::Anthropic,
                    models: vec![ProviderModel {
                        id: "model-a".to_owned(),
                        tool_calling: false,
                    }],
                    ..new_provider("main")
                },
            )
            .await?;
        let custom_binding = providers
            .bind(ada, custom.id, "model-a", Some(ApiFormat::OpenAiCompatible))
            .await?;
        let absent_custom = providers
            .bind(ada, custom.id, "absent", Some(ApiFormat::Gemini))
            .await?;
        let listed = providers.list(ada).await?;
        let deepseek = deepseek(&listed).ok_or("DeepSeek missing")?;
        let followed = providers
            .bind(
                ada,
                deepseek.id,
                "deepseek-flash",
                Some(ApiFormat::OpenAiCompatible),
            )
            .await?;
        let fallback = providers
            .bind(ada, deepseek.id, "deepseek-flash", Some(ApiFormat::Gemini))
            .await?;
        let absent_predefined = providers.bind(ada, deepseek.id, "absent", None).await?;

        assert_eq!(custom_binding.adapter.0.api_format, ApiFormat::Anthropic);
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
    })
    .await
}

#[tokio::test]
async fn predefined_check_uses_its_default_format_endpoint() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let listed = providers.list(ada).await?;
        let id = deepseek(&listed).ok_or("DeepSeek missing")?.id;
        providers
            .update_predefined(
                ada,
                id,
                UpdatePredefinedInput {
                    api_key: Some("sk-deepseek".to_owned()),
                    default_api_format: Some(ApiFormat::OpenAiCompatible),
                    ..Default::default()
                },
            )
            .await?;

        let checked = providers.check_for(ada, id, "deepseek-flash").await;

        assert!(
            matches!(&checked, Err(ProviderError::Check(message))
                if message == "refused at https://api.deepseek.com with sk-deepseek"),
            "default OpenAI endpoint: {checked:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn concurrent_enable_and_key_clear_never_enable_without_a_key() -> Result<(), Box<dyn Error>>
{
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let listed = providers.list(ada).await?;
        let id = deepseek(&listed).ok_or("DeepSeek missing")?.id;
        providers
            .update_predefined(
                ada,
                id,
                UpdatePredefinedInput {
                    api_key: Some("sk-deepseek".to_owned()),
                    ..Default::default()
                },
            )
            .await?;

        let enable = providers.update_predefined(
            ada,
            id,
            UpdatePredefinedInput {
                enabled: Some(true),
                ..Default::default()
            },
        );
        let clear = providers.update_predefined(
            ada,
            id,
            UpdatePredefinedInput {
                api_key: Some(String::new()),
                ..Default::default()
            },
        );
        let (enabled, cleared) = tokio::join!(enable, clear);

        let listed = providers.list(ada).await?;
        let after = deepseek(&listed).ok_or("DeepSeek missing")?;
        assert!(
            !after.enabled || !after.api_key.is_empty(),
            "enabled={} key_empty={} enable={enabled:?} clear={cleared:?}",
            after.enabled,
            after.api_key.is_empty()
        );

        if after.enabled {
            providers
                .update_predefined(
                    ada,
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
                ada,
                id,
                UpdatePredefinedInput {
                    api_key: Some(String::new()),
                    ..Default::default()
                },
            )
            .await?;
        assert!(!cleared.enabled, "clearing the key disables the provider");
        assert!(cleared.api_key.is_empty(), "key cleared");
        Ok(())
    })
    .await
}
