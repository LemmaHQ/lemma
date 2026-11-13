//! Web provider storage, ordering, and backend resolution flows.

use std::error::Error;

use lemma_auth::AuthService;
use lemma_model::{Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest};
use lemma_provider::{
    ProviderError, ProviderService, UpdateWebInput, WebFunction, WebProviderKind, WebProviderView,
};
use lemma_test_db::on_each_database;
use sea_orm::DatabaseConnection;
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use uuid::Uuid;

struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut migrations = lemma_auth::migrations();
        migrations.extend(lemma_provider::migrations());
        migrations
    }
}

#[derive(Debug)]
struct NoAdapter;

impl Adapter for NoAdapter {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        Err(ModelError::new("no model".to_owned()))
    }
}

#[derive(Debug)]
struct NoConnector;

impl Connector for NoConnector {
    type Adapter = NoAdapter;

    fn connect(&self, _endpoint: Endpoint) -> NoAdapter {
        NoAdapter
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(Vec::new())
    }
}

async fn sign_up(db: &DatabaseConnection, username: &str) -> Result<Uuid, Box<dyn Error>> {
    Ok(AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up(
            username,
            &format!("{username}@example.com"),
            "correct-horse",
        )
        .await?
        .user
        .id)
}

fn service(db: DatabaseConnection) -> ProviderService<NoConnector> {
    ProviderService::new(db, "test-secret-key".to_owned(), NoConnector)
}

fn view(
    views: &[WebProviderView],
    kind: WebProviderKind,
) -> Result<&WebProviderView, Box<dyn Error>> {
    views
        .iter()
        .find(|view| view.kind == kind)
        .ok_or_else(|| format!("{kind:?} missing").into())
}

async fn enable(
    providers: &ProviderService<NoConnector>,
    user_id: Uuid,
    kind: WebProviderKind,
    key: &str,
) -> Result<WebProviderView, Box<dyn Error>> {
    let id = view(&providers.list_web(user_id).await?, kind)?.id;
    Ok(providers
        .update_web(
            user_id,
            id,
            UpdateWebInput {
                api_key: Some(key.to_owned()),
                enabled: Some(true),
            },
        )
        .await?)
}

#[tokio::test]
async fn web_providers_are_seeded_once_per_user() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);

        let first = providers.list_web(ada).await?;
        let second = providers.list_web(ada).await?;
        let other = providers.list_web(bob).await?;
        let search = providers.web_backends(ada, WebFunction::Search).await?;
        let fetch = providers.web_backends(ada, WebFunction::Fetch).await?;

        assert_eq!(second, first, "idempotent seed");
        assert_eq!(
            first.iter().map(|view| view.kind).collect::<Vec<_>>(),
            [
                WebProviderKind::Native,
                WebProviderKind::Exa,
                WebProviderKind::DeepSeek,
            ]
        );
        assert!(first[0].enabled, "native fetch starts enabled");
        assert!(
            !first[1].enabled && !first[2].enabled,
            "accounts start disabled"
        );
        assert!(first.iter().all(|view| !view.has_key), "no initial keys");
        assert_eq!(first[0].name, "Native");
        assert_eq!(first[1].name, "Exa");
        assert_eq!(first[2].name, "DeepSeek");
        for (index, view) in first.iter().enumerate() {
            assert_eq!(view.search_rank, index as i32, "initial search rank");
            assert_eq!(view.fetch_rank, index as i32, "initial fetch rank");
            assert!(
                other.iter().all(|other| other.id != view.id),
                "user-scoped rows"
            );
        }
        assert!(search.is_empty(), "native does not search");
        assert_eq!(fetch.len(), 1, "only native fetch is configured");
        assert_eq!(fetch[0].kind, WebProviderKind::Native);
        assert_eq!(fetch[0].base_url, "");
        assert_eq!(fetch[0].api_key, "");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn web_updates_validate_keys_and_clear_atomically() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let bob = sign_up(&db, "bob").await?;
        let providers = service(db);
        let listed = providers.list_web(ada).await?;
        let native = view(&listed, WebProviderKind::Native)?;
        let exa = view(&listed, WebProviderKind::Exa)?;

        let unchanged = providers
            .update_web(ada, exa.id, UpdateWebInput::default())
            .await?;
        let without_key = providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    enabled: Some(true),
                    ..Default::default()
                },
            )
            .await;
        let disabled_native = providers
            .update_web(
                ada,
                native.id,
                UpdateWebInput {
                    enabled: Some(false),
                    ..Default::default()
                },
            )
            .await?;
        let enabled_native = providers
            .update_web(
                ada,
                native.id,
                UpdateWebInput {
                    enabled: Some(true),
                    ..Default::default()
                },
            )
            .await?;
        let enabled = providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    api_key: Some("sk-exa".to_owned()),
                    enabled: Some(true),
                },
            )
            .await?;
        let cleared = providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    api_key: Some(String::new()),
                    enabled: Some(true),
                },
            )
            .await?;
        let keyed = providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    api_key: Some("sk-next".to_owned()),
                    enabled: None,
                },
            )
            .await?;
        let reenabled = providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    enabled: Some(true),
                    api_key: None,
                },
            )
            .await?;
        let missing = providers
            .update_web(ada, Uuid::new_v4(), UpdateWebInput::default())
            .await;
        let foreign = providers
            .update_web(bob, exa.id, UpdateWebInput::default())
            .await;

        assert_eq!(&unchanged, exa, "empty patch");
        assert!(matches!(without_key, Err(ProviderError::KeyRequired)));
        assert!(!disabled_native.enabled, "native disabled");
        assert!(
            enabled_native.enabled && !enabled_native.has_key,
            "native needs no key"
        );
        assert!(enabled.enabled && enabled.has_key, "key enables account");
        assert!(
            !cleared.enabled && !cleared.has_key,
            "clear overrides enable"
        );
        assert!(
            !keyed.enabled && keyed.has_key,
            "key patch retains disabled state"
        );
        assert!(
            reenabled.enabled && reenabled.has_key,
            "saved key enables account"
        );
        assert!(matches!(missing, Err(ProviderError::NotFound)));
        assert!(matches!(foreign, Err(ProviderError::NotFound)));
        Ok(())
    })
    .await
}

#[tokio::test]
async fn web_orders_validate_exact_sets_and_resolve_backends() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db);
        let exa = enable(&providers, ada, WebProviderKind::Exa, "sk-exa").await?;
        let deepseek = enable(&providers, ada, WebProviderKind::DeepSeek, "sk-deepseek").await?;
        let listed = providers.list_web(ada).await?;
        let native = view(&listed, WebProviderKind::Native)?;

        let initial_search = providers.web_backends(ada, WebFunction::Search).await?;
        let initial_fetch = providers.web_backends(ada, WebFunction::Fetch).await?;
        let search_order = providers
            .set_web_order(ada, WebFunction::Search, vec![deepseek.id, exa.id])
            .await?;
        let fetch_order = providers
            .set_web_order(
                ada,
                WebFunction::Fetch,
                vec![deepseek.id, exa.id, native.id],
            )
            .await?;
        let search = providers.web_backends(ada, WebFunction::Search).await?;
        let fetch = providers.web_backends(ada, WebFunction::Fetch).await?;

        assert_eq!(
            initial_search
                .iter()
                .map(|backend| backend.kind)
                .collect::<Vec<_>>(),
            [WebProviderKind::Exa, WebProviderKind::DeepSeek]
        );
        assert_eq!(
            initial_fetch
                .iter()
                .map(|backend| backend.kind)
                .collect::<Vec<_>>(),
            [
                WebProviderKind::Native,
                WebProviderKind::Exa,
                WebProviderKind::DeepSeek,
            ]
        );
        assert_eq!(
            view(&search_order, WebProviderKind::DeepSeek)?.search_rank,
            0
        );
        assert_eq!(view(&search_order, WebProviderKind::Exa)?.search_rank, 1);
        assert_eq!(view(&fetch_order, WebProviderKind::DeepSeek)?.fetch_rank, 0);
        assert_eq!(view(&fetch_order, WebProviderKind::Exa)?.fetch_rank, 1);
        assert_eq!(view(&fetch_order, WebProviderKind::Native)?.fetch_rank, 2);
        assert_eq!(
            search
                .iter()
                .map(|backend| backend.kind)
                .collect::<Vec<_>>(),
            [WebProviderKind::DeepSeek, WebProviderKind::Exa]
        );
        assert_eq!(search[0].base_url, "https://api.deepseek.com");
        assert_eq!(search[0].api_key, "sk-deepseek");
        assert_eq!(search[1].base_url, "https://api.exa.ai");
        assert_eq!(search[1].api_key, "sk-exa");
        assert_eq!(
            fetch.iter().map(|backend| backend.kind).collect::<Vec<_>>(),
            [
                WebProviderKind::DeepSeek,
                WebProviderKind::Exa,
                WebProviderKind::Native,
            ]
        );

        for (function, ids) in [
            (WebFunction::Search, Vec::new()),
            (WebFunction::Search, vec![exa.id, exa.id]),
            (WebFunction::Search, vec![exa.id, deepseek.id, native.id]),
            (WebFunction::Fetch, vec![exa.id, deepseek.id]),
            (
                WebFunction::Fetch,
                vec![exa.id, deepseek.id, Uuid::new_v4()],
            ),
        ] {
            let result = providers.set_web_order(ada, function, ids).await;
            assert!(
                matches!(result, Err(ProviderError::NotFound)),
                "invalid order"
            );
        }
        let unchanged = providers.list_web(ada).await?;
        assert_eq!(view(&unchanged, WebProviderKind::DeepSeek)?.search_rank, 0);
        assert_eq!(view(&unchanged, WebProviderKind::Native)?.fetch_rank, 2);

        providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    enabled: Some(false),
                    ..Default::default()
                },
            )
            .await?;
        providers
            .update_web(
                ada,
                deepseek.id,
                UpdateWebInput {
                    api_key: Some(String::new()),
                    ..Default::default()
                },
            )
            .await?;
        providers
            .update_web(
                ada,
                native.id,
                UpdateWebInput {
                    enabled: Some(false),
                    ..Default::default()
                },
            )
            .await?;
        assert!(
            providers
                .web_backends(ada, WebFunction::Search)
                .await?
                .is_empty()
        );
        assert!(
            providers
                .web_backends(ada, WebFunction::Fetch)
                .await?
                .is_empty()
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn web_key_races_and_open_failures_never_return_invalid_backends()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let ada = sign_up(&db, "ada").await?;
        let providers = service(db.clone());
        let exa = enable(&providers, ada, WebProviderKind::Exa, "sk-exa").await?;
        providers
            .update_web(
                ada,
                exa.id,
                UpdateWebInput {
                    enabled: Some(false),
                    ..Default::default()
                },
            )
            .await?;

        let enabling = providers.update_web(
            ada,
            exa.id,
            UpdateWebInput {
                enabled: Some(true),
                ..Default::default()
            },
        );
        let clear = providers.update_web(
            ada,
            exa.id,
            UpdateWebInput {
                api_key: Some(String::new()),
                ..Default::default()
            },
        );
        let (enabled, cleared) = tokio::join!(enabling, clear);
        let listed = providers.list_web(ada).await?;
        let after = view(&listed, WebProviderKind::Exa)?;
        assert!(
            !after.enabled || after.has_key,
            "enabled={} has_key={} enable={enabled:?} clear={cleared:?}",
            after.enabled,
            after.has_key
        );

        enable(&providers, ada, WebProviderKind::Exa, "sk-exa").await?;
        let rotated = ProviderService::new(db, "rotated".to_owned(), NoConnector);
        let opened = rotated.web_backends(ada, WebFunction::Search).await;
        assert!(matches!(opened, Err(ProviderError::Crypto(_))));
        Ok(())
    })
    .await
}

#[tokio::test]
async fn web_methods_report_database_failures() -> Result<(), Box<dyn Error>> {
    let db = sea_orm::Database::connect("sqlite::memory:").await?;
    db.clone().close().await?;
    let providers = service(db);
    let id = Uuid::new_v4();
    let user = Uuid::new_v4();
    let listed = providers.list_web(user).await;
    let updated = providers
        .update_web(user, id, UpdateWebInput::default())
        .await;
    let ordered = providers
        .set_web_order(user, WebFunction::Search, Vec::new())
        .await;
    let backends = providers.web_backends(user, WebFunction::Fetch).await;

    for result in [
        listed.err().map(|error| error.to_string()),
        updated.err().map(|error| error.to_string()),
        ordered.err().map(|error| error.to_string()),
        backends.err().map(|error| error.to_string()),
    ] {
        assert!(
            result.is_some_and(|error| error.starts_with("store:")),
            "store error"
        );
    }
    Ok(())
}
