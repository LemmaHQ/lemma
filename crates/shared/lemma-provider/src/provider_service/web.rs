use std::collections::HashSet;

use chrono::Utc;
use lemma_model::Connector;
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ColumnTrait, Condition, EntityTrait, NotSet, QueryFilter, QueryOrder, Set, TransactionTrait,
};
use uuid::Uuid;

use crate::entity::web_provider::{self, WebProviderKind};
use crate::provider_error::ProviderError;

use super::providers::ProviderService;
use super::web_provider::{UpdateWebInput, WebBackend, WebFunction, WebProviderView};

impl<C: Connector> ProviderService<C> {
    /// Lists every web provider, inserting missing built-in rows first.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Store`] when the database fails.
    pub async fn list_web(&self, user_id: Uuid) -> Result<Vec<WebProviderView>, ProviderError> {
        self.insert_missing_web(user_id).await?;
        let mut rows = self.web_rows(user_id).await?;
        rows.sort_by_key(|row| row.kind);
        Ok(rows.iter().map(Self::web_view).collect())
    }

    /// Updates a web provider's API key or enabled flag.
    ///
    /// Clearing the key disables the provider in the same statement. Enabling
    /// a non-native provider against its saved key requires that key to remain
    /// present at write time.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the provider is absent,
    /// [`ProviderError::KeyRequired`] when enabling a non-native provider
    /// without a key, [`ProviderError::Crypto`] when sealing fails, and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn update_web(
        &self,
        user_id: Uuid,
        id: Uuid,
        input: UpdateWebInput,
    ) -> Result<WebProviderView, ProviderError> {
        let row = web_provider::Entity::find_by_id(id)
            .filter(web_provider::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?
            .ok_or(ProviderError::NotFound)?;
        let clearing_key = input.api_key.as_deref() == Some("");
        let has_key = input
            .api_key
            .as_ref()
            .map_or(!row.api_key.is_empty(), |key| !key.is_empty());
        let enabled = !clearing_key && input.enabled.unwrap_or(row.enabled);
        if row.kind != WebProviderKind::Native && enabled && !has_key {
            return Err(ProviderError::KeyRequired);
        }
        if input.api_key.is_none() && input.enabled.is_none() {
            return Ok(Self::web_view(&row));
        }
        let enabling_saved_key = input.enabled == Some(true)
            && input.api_key.is_none()
            && row.kind != WebProviderKind::Native;
        let api_key = match input.api_key {
            Some(key) => Set(self.seal_key(&key)?),
            None => NotSet,
        };
        let enabled = if clearing_key {
            Set(false)
        } else {
            input.enabled.map_or(NotSet, Set)
        };
        let update = web_provider::Entity::update_many()
            .set(web_provider::ActiveModel {
                api_key,
                enabled,
                ..Default::default()
            })
            .filter(web_provider::Column::Id.eq(id))
            .filter(web_provider::Column::UserId.eq(user_id));
        if enabling_saved_key {
            let updated = update
                .filter(web_provider::Column::ApiKey.ne(""))
                .exec_with_returning(&self.db)
                .await?
                .pop()
                .ok_or(ProviderError::KeyRequired)?;
            return Ok(Self::web_view(&updated));
        }
        let updated = update
            .exec_with_returning(&self.db)
            .await?
            .pop()
            .ok_or(ProviderError::NotFound)?;
        Ok(Self::web_view(&updated))
    }

    /// Replaces the complete fallback order for a web function.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the ids are not exactly the user's
    /// providers supporting the function, and [`ProviderError::Store`] when
    /// the database fails.
    pub async fn set_web_order(
        &self,
        user_id: Uuid,
        function: WebFunction,
        ids: Vec<Uuid>,
    ) -> Result<Vec<WebProviderView>, ProviderError> {
        self.insert_missing_web(user_id).await?;
        let rows = self.web_rows(user_id).await?;
        let expected: HashSet<_> = rows
            .iter()
            .filter(|row| row.kind.supports(function))
            .map(|row| row.id)
            .collect();
        let supplied: HashSet<_> = ids.iter().copied().collect();
        if supplied.len() != ids.len() || supplied != expected {
            return Err(ProviderError::NotFound);
        }
        let tx = self.db.begin().await?;
        for (rank, id) in ids.into_iter().enumerate() {
            let rank = rank as i32;
            let changes = match function {
                WebFunction::Search => web_provider::ActiveModel {
                    search_rank: Set(rank),
                    ..Default::default()
                },
                WebFunction::Fetch => web_provider::ActiveModel {
                    fetch_rank: Set(rank),
                    ..Default::default()
                },
            };
            web_provider::Entity::update_many()
                .set(changes)
                .filter(web_provider::Column::Id.eq(id))
                .filter(web_provider::Column::UserId.eq(user_id))
                .exec(&tx)
                .await?;
        }
        tx.commit().await?;
        self.list_web(user_id).await
    }

    /// Resolves enabled backends in fallback order, excluding keyless accounts.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Crypto`] when a stored key cannot be opened and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn web_backends(
        &self,
        user_id: Uuid,
        function: WebFunction,
    ) -> Result<Vec<WebBackend>, ProviderError> {
        self.insert_missing_web(user_id).await?;
        let query = web_provider::Entity::find()
            .filter(web_provider::Column::UserId.eq(user_id))
            .filter(web_provider::Column::Enabled.eq(true))
            .filter(
                Condition::any()
                    .add(web_provider::Column::Kind.eq(WebProviderKind::Native))
                    .add(web_provider::Column::ApiKey.ne("")),
            );
        let rows = match function {
            WebFunction::Search => query
                .filter(web_provider::Column::Kind.ne(WebProviderKind::Native))
                .order_by_asc(web_provider::Column::SearchRank),
            WebFunction::Fetch => query.order_by_asc(web_provider::Column::FetchRank),
        }
        .order_by_asc(web_provider::Column::Kind)
        .all(&self.db)
        .await?;
        rows.iter()
            .map(|row| {
                Ok(WebBackend {
                    kind: row.kind,
                    base_url: row.kind.base_url().to_owned(),
                    api_key: if row.kind == WebProviderKind::Native {
                        String::new()
                    } else {
                        self.open_key(&row.api_key)?
                    },
                })
            })
            .collect()
    }

    async fn insert_missing_web(&self, user_id: Uuid) -> Result<(), ProviderError> {
        let now = Utc::now();
        let rows = [
            (WebProviderKind::Native, true, 0),
            (WebProviderKind::Exa, false, 1),
            (WebProviderKind::DeepSeek, false, 2),
        ]
        .into_iter()
        .map(|(kind, enabled, rank)| web_provider::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            kind: Set(kind),
            api_key: Set(String::new()),
            enabled: Set(enabled),
            search_rank: Set(rank),
            fetch_rank: Set(rank),
            created_at: Set(now),
        });
        web_provider::Entity::insert_many(rows)
            .on_conflict(
                OnConflict::columns([web_provider::Column::UserId, web_provider::Column::Kind])
                    .do_nothing()
                    .to_owned(),
            )
            .exec_without_returning(&self.db)
            .await?;
        Ok(())
    }

    async fn web_rows(&self, user_id: Uuid) -> Result<Vec<web_provider::Model>, ProviderError> {
        web_provider::Entity::find()
            .filter(web_provider::Column::UserId.eq(user_id))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    fn web_view(row: &web_provider::Model) -> WebProviderView {
        WebProviderView {
            id: row.id,
            kind: row.kind,
            name: row.kind.name().to_owned(),
            enabled: row.enabled,
            has_key: !row.api_key.is_empty(),
            search_rank: row.search_rank,
            fetch_rank: row.fetch_rank,
        }
    }
}
