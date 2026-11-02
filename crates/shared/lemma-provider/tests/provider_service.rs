//! Provider flows against a migrated database.

use std::error::Error;

use lemma_auth::AuthService;
use lemma_crypto::CryptoError;
use lemma_model::{
    Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest, ProviderKind,
};
use lemma_provider::{CreateInput, ProviderError, ProviderService, UpdateInput};
use lemma_test_db::on_each_database;
use sea_orm::{ConnectionTrait, DatabaseConnection};
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
            endpoint.kind.as_str().to_owned(),
            endpoint.base_url,
            endpoint.models_path,
            endpoint.api_key,
        ])
    }
}

async fn sign_up(db: &DatabaseConnection, username: &str) -> Result<Uuid, Box<dyn Error>> {
    let session = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up(
            username,
            &format!("{username}@example.com"),
            "correct-horse",
        )
        .await?;
    Ok(session.user.id)
}

fn service(db: DatabaseConnection) -> ProviderService<EndpointConnector> {
    ProviderService::new(db, "test-secret-key".to_owned(), EndpointConnector)
}

fn new_provider(identifier: &str) -> CreateInput {
    CreateInput {
        kind: ProviderKind::OpenAiCompatible,
        identifier: identifier.to_owned(),
        name: "Main".to_owned(),
        base_url: "https://api.example.com/v1/".to_owned(),
        api_key: "sk-original".to_owned(),
        api_path: "/chat".to_owned(),
        models_path: "/models".to_owned(),
        models: vec!["model-a".to_owned()],
    }
}

#[tokio::test]
async fn a_user_cannot_see_or_change_another_users_provider() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);
        let created = providers.create(ada, new_provider("main")).await?;

        let listed = providers.list(bob).await?;
        let adapter = providers.adapter(bob, created.id).await;
        let updated = providers
            .update(
                bob,
                created.id,
                UpdateInput {
                    name: Some("Hijacked".to_owned()),
                    ..Default::default()
                },
            )
            .await;
        let read_through_update = providers
            .update(bob, created.id, UpdateInput::default())
            .await;
        let missing = providers
            .update(bob, Uuid::new_v4(), UpdateInput::default())
            .await;
        let own = providers.list(ada).await?;

        assert!(listed.is_empty(), "bob's providers: {listed:?}");
        assert!(
            matches!(adapter, Err(ProviderError::NotFound)),
            "bob's adapter: {adapter:?}"
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
        assert_eq!(own.len(), 1, "ada's providers: {own:?}");
        assert_eq!(own[0].name, "Main", "ada's name survives bob's update");
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
        providers.create(ada, new_provider("main")).await?;

        let duplicate = providers.create(ada, new_provider("main")).await;
        let other_identifier = providers.create(ada, new_provider("backup")).await;
        let other_user = providers.create(bob, new_provider("main")).await;

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
        let before = providers.create(ada, new_provider("main")).await?;

        let toggled = providers
            .update(
                ada,
                before.id,
                UpdateInput {
                    enabled: Some(false),
                    models: Some(vec!["model-b".to_owned()]),
                    ..Default::default()
                },
            )
            .await?;
        let rekeyed = providers
            .update(
                ada,
                before.id,
                UpdateInput {
                    api_key: Some("sk-replaced".to_owned()),
                    ..Default::default()
                },
            )
            .await?;
        let untouched = providers
            .update(ada, before.id, UpdateInput::default())
            .await?;
        let bound = providers.adapter(ada, before.id).await?;

        assert!(!toggled.enabled, "enabled flag");
        assert_eq!(toggled.models, ["model-b"], "model list");
        assert_eq!(toggled.name, before.name, "name");
        assert_eq!(toggled.base_url, before.base_url, "base URL");
        assert_eq!(toggled.api_key, "sk-original", "api key");
        assert_eq!(toggled.api_path, before.api_path, "generation path");
        assert_eq!(toggled.models_path, before.models_path, "model-list path");
        assert_eq!(rekeyed.api_key, "sk-replaced", "replaced api key");
        assert!(!rekeyed.enabled, "enabled flag after the key change");
        assert_eq!(
            rekeyed.models,
            ["model-b"],
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
        let mine = providers.create(ada, new_provider("main")).await?;
        let theirs = providers.create(bob, new_provider("main")).await?;

        let foreign = providers.delete(bob, mine.id).await;
        let survivors = providers.list(ada).await?;
        providers.delete(ada, mine.id).await?;
        let again = providers.delete(ada, mine.id).await;
        let ada_after = providers.list(ada).await?;
        let bob_after = providers.list(bob).await?;

        assert!(
            matches!(foreign, Err(ProviderError::NotFound)),
            "bob deleting ada's provider: {foreign:?}"
        );
        assert_eq!(survivors.len(), 1, "ada's providers after bob's delete");
        assert!(
            matches!(again, Err(ProviderError::NotFound)),
            "second delete: {again:?}"
        );
        assert!(ada_after.is_empty(), "ada's providers: {ada_after:?}");
        assert_eq!(bob_after.len(), 1, "bob's providers: {bob_after:?}");
        assert_eq!(bob_after[0].id, theirs.id, "bob's provider");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn create_requires_an_ascii_identifier_and_a_base_url() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);

        let blank = providers.create(ada, new_provider("  ")).await;
        let non_ascii = providers.create(ada, new_provider("主要")).await;
        let no_base_url = providers
            .create(
                ada,
                CreateInput {
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
        assert!(providers.list(ada).await?.is_empty(), "nothing was created");
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
            .create(
                ada,
                CreateInput {
                    name: " ".to_owned(),
                    api_key: String::new(),
                    ..new_provider(" local ")
                },
            )
            .await?;
        let bound = providers.adapter(ada, created.id).await?;

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
            .create(
                ada,
                CreateInput {
                    kind: ProviderKind::Anthropic,
                    ..new_provider("main")
                },
            )
            .await?;

        let bound = providers.adapter(ada, created.id).await?.0;

        assert_eq!(bound.kind, ProviderKind::Anthropic, "kind");
        assert_eq!(bound.base_url, "https://api.example.com/v1", "base URL");
        assert_eq!(bound.api_key, "sk-original", "opened key");
        assert_eq!(
            (bound.api_path.as_str(), bound.models_path.as_str()),
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
        let created = providers.create(ada, new_provider("main")).await?;

        let stored = providers.fetch_models_for(ada, created.id).await?;
        let adhoc = providers
            .fetch_models_adhoc(
                ProviderKind::Gemini,
                " https://gemini.example.com/ ",
                "g-key",
                " /v1/models ",
            )
            .await?;
        let unreachable = providers
            .fetch_models_adhoc(ProviderKind::Gemini, "https://unreachable.example", "", "")
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
            .create(ada, new_provider("main"))
            .await?;
        let rotated = ProviderService::new(db.clone(), "rotated".to_owned(), EndpointConnector);

        let with_rotated_secret = rotated.adapter(ada, created.id).await;
        let listed = rotated.list(ada).await?;
        db.execute_unprepared("UPDATE providers SET api_key = 'not sealed'")
            .await?;
        let corrupted = service(db).adapter(ada, created.id).await;

        assert!(
            matches!(
                &with_rotated_secret,
                Err(ProviderError::Crypto(CryptoError::Decrypt))
            ),
            "rotated secret: {with_rotated_secret:?}"
        );
        assert_eq!(
            listed
                .iter()
                .map(|p| p.api_key.as_str())
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
        let created = providers.create(ada, new_provider("main")).await?;

        Migrator::down(&db, None).await?;
        let listed = providers.list(ada).await;
        let inserted = providers.create(ada, new_provider("main")).await;
        let disabled = UpdateInput {
            enabled: Some(false),
            ..Default::default()
        };
        let updated = providers.update(ada, created.id, disabled).await;
        let deleted = providers.delete(ada, created.id).await;
        Migrator::up(&db, None).await?;

        for (operation, failed) in [
            ("list", listed.err()),
            ("create", inserted.err()),
            ("update", updated.err()),
            ("delete", deleted.err()),
        ] {
            assert!(
                matches!(failed, Some(ProviderError::Store(_))),
                "{operation} without tables: {failed:?}"
            );
        }
        let ada = sign_up(&db, "ada").await?;
        assert!(
            providers.list(ada).await?.is_empty(),
            "rolled back rows are gone"
        );
        providers.create(ada, new_provider("main")).await?;
        Ok(())
    })
    .await
}
