//! Provider flows against a migrated database.

use std::error::Error;

use lemma_auth::AuthService;
use lemma_model::{
    Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest, ProviderKind,
};
use lemma_provider::{CreateInput, ProviderError, ProviderService, UpdateInput};
use lemma_test_db::on_each_database;
use sea_orm::DatabaseConnection;
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
        Err(ModelError::new("unused".to_owned()))
    }
}

struct EndpointConnector;

impl Connector for EndpointConnector {
    type Adapter = BoundEndpoint;

    fn connect(&self, endpoint: Endpoint) -> BoundEndpoint {
        BoundEndpoint(endpoint)
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(vec![])
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
        let bound = providers.adapter(ada, before.id).await?;

        assert!(!toggled.enabled, "enabled flag");
        assert_eq!(toggled.models, ["model-b"], "model list");
        assert_eq!(toggled.name, before.name, "name");
        assert_eq!(toggled.base_url, before.base_url, "base URL");
        assert_eq!(toggled.api_key, "sk-original", "api key");
        assert_eq!(toggled.api_path, before.api_path, "generation path");
        assert_eq!(toggled.models_path, before.models_path, "model-list path");
        assert_eq!(toggled.created_at, before.created_at, "creation time");
        assert_eq!(rekeyed.api_key, "sk-replaced", "replaced api key");
        assert!(!rekeyed.enabled, "enabled flag after the key change");
        assert_eq!(
            rekeyed.models,
            ["model-b"],
            "model list after the key change"
        );
        assert_eq!(bound.0.api_key, "sk-replaced", "key the adapter opens");
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
