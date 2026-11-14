//! Web provider storage, ordering, and backend resolution flows.

use std::error::Error;

use sqlx::SqlitePool;
use uuid::Uuid;

use lemma_model::{Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest};
use lemma_provider::{
    ProviderError, ProviderService, UpdateWebInput, WebFunction, WebProviderKind, WebProviderView,
};

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

fn service(db: SqlitePool) -> ProviderService<NoConnector> {
    ProviderService::new(db, "test-secret-key", NoConnector)
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
    kind: WebProviderKind,
    key: &str,
) -> Result<WebProviderView, Box<dyn Error>> {
    let id = view(&providers.list_web().await?, kind)?.id;
    Ok(providers
        .update_web(
            id,
            UpdateWebInput {
                api_key: Some(key.to_owned()),
                enabled: Some(true),
            },
        )
        .await?)
}

#[tokio::test]
async fn web_providers_are_seeded_once() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);

    let first = providers.list_web().await?;
    let second = providers.list_web().await?;
    let search = providers.web_backends(WebFunction::Search).await?;
    let fetch = providers.web_backends(WebFunction::Fetch).await?;

    assert_eq!(second, first, "idempotent seed");
    assert_eq!(
        first.iter().map(|view| view.kind).collect::<Vec<_>>(),
        [
            WebProviderKind::Native,
            WebProviderKind::Exa,
            WebProviderKind::DeepSeek,
        ],
        "seeded kinds in order"
    );
    assert!(first[0].enabled, "native fetch starts enabled");
    assert!(
        !first[1].enabled && !first[2].enabled,
        "accounts start disabled"
    );
    assert!(
        first.iter().all(|view| view.api_key.is_empty()),
        "no initial keys"
    );
    assert_eq!(first[0].name, "Native", "native display name");
    assert_eq!(first[1].name, "Exa", "exa display name");
    assert_eq!(first[2].name, "DeepSeek", "deepseek display name");
    for (index, view) in first.iter().enumerate() {
        assert_eq!(view.search_rank, index as i32, "initial search rank");
        assert_eq!(view.fetch_rank, index as i32, "initial fetch rank");
    }
    assert!(search.is_empty(), "native does not search");
    assert_eq!(fetch.len(), 1, "only native fetch is configured");
    assert_eq!(
        fetch[0].kind,
        WebProviderKind::Native,
        "native backend kind"
    );
    assert_eq!(fetch[0].base_url, "", "native backend base URL");
    assert_eq!(fetch[0].api_key, "", "native backend api key");
    Ok(())
}

#[tokio::test]
async fn web_updates_validate_keys_and_clear_atomically() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let listed = providers.list_web().await?;
    let native = view(&listed, WebProviderKind::Native)?;
    let exa = view(&listed, WebProviderKind::Exa)?;

    let unchanged = providers
        .update_web(exa.id, UpdateWebInput::default())
        .await?;
    let without_key = providers
        .update_web(
            exa.id,
            UpdateWebInput {
                enabled: Some(true),
                ..Default::default()
            },
        )
        .await;
    let disabled_native = providers
        .update_web(
            native.id,
            UpdateWebInput {
                enabled: Some(false),
                ..Default::default()
            },
        )
        .await?;
    let enabled_native = providers
        .update_web(
            native.id,
            UpdateWebInput {
                enabled: Some(true),
                ..Default::default()
            },
        )
        .await?;
    let enabled = providers
        .update_web(
            exa.id,
            UpdateWebInput {
                api_key: Some("sk-exa".to_owned()),
                enabled: Some(true),
            },
        )
        .await?;
    let cleared = providers
        .update_web(
            exa.id,
            UpdateWebInput {
                api_key: Some(String::new()),
                enabled: Some(true),
            },
        )
        .await?;
    let keyed = providers
        .update_web(
            exa.id,
            UpdateWebInput {
                api_key: Some("sk-next".to_owned()),
                enabled: None,
            },
        )
        .await?;
    let reenabled = providers
        .update_web(
            exa.id,
            UpdateWebInput {
                enabled: Some(true),
                api_key: None,
            },
        )
        .await?;
    let missing = providers
        .update_web(Uuid::new_v4(), UpdateWebInput::default())
        .await;

    assert_eq!(&unchanged, exa, "empty patch");
    assert!(
        matches!(without_key, Err(ProviderError::KeyRequired)),
        "enable without key: {without_key:?}"
    );
    assert!(!disabled_native.enabled, "native disabled");
    assert!(
        enabled_native.enabled && enabled_native.api_key.is_empty(),
        "native needs no key"
    );
    assert!(
        enabled.enabled && enabled.api_key == "sk-exa",
        "key enables account"
    );
    assert!(
        !cleared.enabled && cleared.api_key.is_empty(),
        "clear overrides enable"
    );
    assert!(
        !keyed.enabled && keyed.api_key == "sk-next",
        "key patch retains disabled state"
    );
    assert!(
        reenabled.enabled && reenabled.api_key == "sk-next",
        "saved key enables account"
    );
    assert!(
        matches!(missing, Err(ProviderError::NotFound)),
        "missing web provider: {missing:?}"
    );
    Ok(())
}

#[tokio::test]
async fn web_orders_validate_exact_sets_and_resolve_backends() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db);
    let exa = enable(&providers, WebProviderKind::Exa, "sk-exa").await?;
    let deepseek = enable(&providers, WebProviderKind::DeepSeek, "sk-deepseek").await?;
    let listed = providers.list_web().await?;
    let native = view(&listed, WebProviderKind::Native)?;

    let initial_search = providers.web_backends(WebFunction::Search).await?;
    let initial_fetch = providers.web_backends(WebFunction::Fetch).await?;
    let search_order = providers
        .set_web_order(WebFunction::Search, &[deepseek.id, exa.id])
        .await?;
    let fetch_order = providers
        .set_web_order(WebFunction::Fetch, &[deepseek.id, exa.id, native.id])
        .await?;
    let search = providers.web_backends(WebFunction::Search).await?;
    let fetch = providers.web_backends(WebFunction::Fetch).await?;

    assert_eq!(
        initial_search
            .iter()
            .map(|backend| backend.kind)
            .collect::<Vec<_>>(),
        [WebProviderKind::Exa, WebProviderKind::DeepSeek],
        "initial search backend order"
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
        ],
        "initial fetch backend order"
    );
    assert_eq!(
        view(&search_order, WebProviderKind::DeepSeek)?.search_rank,
        0,
        "deepseek search rank"
    );
    assert_eq!(
        view(&search_order, WebProviderKind::Exa)?.search_rank,
        1,
        "exa search rank"
    );
    assert_eq!(
        view(&fetch_order, WebProviderKind::DeepSeek)?.fetch_rank,
        0,
        "deepseek fetch rank"
    );
    assert_eq!(
        view(&fetch_order, WebProviderKind::Exa)?.fetch_rank,
        1,
        "exa fetch rank"
    );
    assert_eq!(
        view(&fetch_order, WebProviderKind::Native)?.fetch_rank,
        2,
        "native fetch rank"
    );
    assert_eq!(
        search
            .iter()
            .map(|backend| backend.kind)
            .collect::<Vec<_>>(),
        [WebProviderKind::DeepSeek, WebProviderKind::Exa],
        "updated search backend order"
    );
    assert_eq!(
        search[0].base_url, "https://api.deepseek.com",
        "deepseek base URL"
    );
    assert_eq!(search[0].api_key, "sk-deepseek", "deepseek key");
    assert_eq!(search[1].base_url, "https://api.exa.ai", "exa base URL");
    assert_eq!(search[1].api_key, "sk-exa", "exa key");
    assert_eq!(
        fetch.iter().map(|backend| backend.kind).collect::<Vec<_>>(),
        [
            WebProviderKind::DeepSeek,
            WebProviderKind::Exa,
            WebProviderKind::Native,
        ],
        "updated fetch backend order"
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
        let result = providers.set_web_order(function, &ids).await;
        assert!(
            matches!(result, Err(ProviderError::NotFound)),
            "invalid order: {result:?}"
        );
    }
    let unchanged = providers.list_web().await?;
    assert_eq!(
        view(&unchanged, WebProviderKind::DeepSeek)?.search_rank,
        0,
        "search rank preserved after invalid update"
    );
    assert_eq!(
        view(&unchanged, WebProviderKind::Native)?.fetch_rank,
        2,
        "fetch rank preserved after invalid update"
    );

    providers
        .update_web(
            exa.id,
            UpdateWebInput {
                enabled: Some(false),
                ..Default::default()
            },
        )
        .await?;
    providers
        .update_web(
            deepseek.id,
            UpdateWebInput {
                api_key: Some(String::new()),
                ..Default::default()
            },
        )
        .await?;
    providers
        .update_web(
            native.id,
            UpdateWebInput {
                enabled: Some(false),
                ..Default::default()
            },
        )
        .await?;
    assert!(
        providers
            .web_backends(WebFunction::Search)
            .await?
            .is_empty(),
        "no enabled search backends"
    );
    assert!(
        providers.web_backends(WebFunction::Fetch).await?.is_empty(),
        "no enabled fetch backends"
    );
    Ok(())
}

#[tokio::test]
async fn web_key_races_and_open_failures_never_return_invalid_backends()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let providers = service(db.clone());
    let exa = enable(&providers, WebProviderKind::Exa, "sk-exa").await?;
    providers
        .update_web(
            exa.id,
            UpdateWebInput {
                enabled: Some(false),
                ..Default::default()
            },
        )
        .await?;

    let enabling = providers.update_web(
        exa.id,
        UpdateWebInput {
            enabled: Some(true),
            ..Default::default()
        },
    );
    let clear = providers.update_web(
        exa.id,
        UpdateWebInput {
            api_key: Some(String::new()),
            ..Default::default()
        },
    );
    let (enabled, cleared) = tokio::join!(enabling, clear);
    let listed = providers.list_web().await?;
    let after = view(&listed, WebProviderKind::Exa)?;
    assert!(
        !after.enabled || !after.api_key.is_empty(),
        "enabled={} api_key={} enable={enabled:?} clear={cleared:?}",
        after.enabled,
        after.api_key
    );

    enable(&providers, WebProviderKind::Exa, "sk-exa").await?;
    let rotated = ProviderService::new(db.clone(), "rotated", NoConnector);
    let opened = rotated.web_backends(WebFunction::Search).await;
    let listed_rotated = rotated.list_web().await;
    sqlx::query("UPDATE web_providers SET api_key = 'not sealed' WHERE kind = 'exa'")
        .execute(&db)
        .await?;
    let listed_corrupted = service(db).list_web().await;
    assert!(
        matches!(opened, Err(ProviderError::Crypto(_))),
        "key open failure: {opened:?}"
    );
    assert!(
        matches!(listed_rotated, Err(ProviderError::Crypto(_))),
        "list_web with rotated secret: {listed_rotated:?}"
    );
    assert!(
        matches!(listed_corrupted, Err(ProviderError::Crypto(_))),
        "list_web with corrupted ciphertext: {listed_corrupted:?}"
    );
    Ok(())
}

#[tokio::test]
async fn web_methods_report_database_failures() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    db.close().await;
    let providers = service(db);
    let id = Uuid::new_v4();
    let listed = providers.list_web().await;
    let updated = providers.update_web(id, UpdateWebInput::default()).await;
    let ordered = providers.set_web_order(WebFunction::Search, &[]).await;
    let backends = providers.web_backends(WebFunction::Fetch).await;

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
