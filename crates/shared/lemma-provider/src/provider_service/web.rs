use std::collections::HashSet;

use chrono::Utc;
use uuid::Uuid;

use lemma_model::Connector;

use crate::provider_error::ProviderError;
use crate::web_provider_kind::WebProviderKind;

use super::providers::ProviderService;
use super::web_provider::{UpdateWebInput, WebBackend, WebFunction, WebProviderView};

type WebTuple = (Uuid, String, String, bool, i32, i32);

struct WebRow {
    id: Uuid,
    kind: WebProviderKind,
    api_key: String,
    enabled: bool,
    search_rank: i32,
    fetch_rank: i32,
}

fn web_row_from_tuple(
    (id, kind, api_key, enabled, search_rank, fetch_rank): WebTuple,
) -> Result<WebRow, ProviderError> {
    Ok(WebRow {
        id,
        kind: WebProviderKind::parse(&kind)?,
        api_key,
        enabled,
        search_rank,
        fetch_rank,
    })
}

impl<C: Connector> ProviderService<C> {
    /// Lists every web provider, inserting missing built-in rows first.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Store`] when the database fails.
    pub async fn list_web(&self) -> Result<Vec<WebProviderView>, ProviderError> {
        self.insert_missing_web().await?;
        let mut rows = self.web_rows().await?;
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
        id: Uuid,
        input: UpdateWebInput,
    ) -> Result<WebProviderView, ProviderError> {
        let row = sqlx::query_as::<_, WebTuple>(
            "SELECT id, kind, api_key, enabled, search_rank, fetch_rank
             FROM web_providers
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .map(web_row_from_tuple)
        .transpose()?
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
        let api_key = input
            .api_key
            .as_deref()
            .map(|key| self.seal_key(key))
            .transpose()?;
        let enabled = if clearing_key {
            Some(false)
        } else {
            input.enabled
        };
        if enabling_saved_key {
            let updated = sqlx::query_as::<_, WebTuple>(
                "UPDATE web_providers
                 SET api_key = COALESCE(?, api_key),
                     enabled = COALESCE(?, enabled)
                 WHERE id = ? AND api_key != ''
                 RETURNING id, kind, api_key, enabled, search_rank, fetch_rank",
            )
            .bind(api_key)
            .bind(enabled)
            .bind(id)
            .fetch_optional(&self.db)
            .await?
            .map(web_row_from_tuple)
            .transpose()?
            .ok_or(ProviderError::KeyRequired)?;
            return Ok(Self::web_view(&updated));
        }
        let updated = sqlx::query_as::<_, WebTuple>(
            "UPDATE web_providers
             SET api_key = COALESCE(?, api_key),
                 enabled = COALESCE(?, enabled)
             WHERE id = ?
             RETURNING id, kind, api_key, enabled, search_rank, fetch_rank",
        )
        .bind(api_key)
        .bind(enabled)
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .map(web_row_from_tuple)
        .transpose()?
        .ok_or(ProviderError::NotFound)?;
        Ok(Self::web_view(&updated))
    }

    /// Replaces the complete fallback order for a web function.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the ids are not exactly the
    /// providers supporting the function, and [`ProviderError::Store`] when
    /// the database fails.
    pub async fn set_web_order(
        &self,
        function: WebFunction,
        ids: &[Uuid],
    ) -> Result<Vec<WebProviderView>, ProviderError> {
        self.insert_missing_web().await?;
        let rows = self.web_rows().await?;
        let expected: HashSet<_> = rows
            .iter()
            .filter(|row| row.kind.supports(function))
            .map(|row| row.id)
            .collect();
        let supplied: HashSet<_> = ids.iter().copied().collect();
        if supplied.len() != ids.len() || supplied != expected {
            return Err(ProviderError::NotFound);
        }
        let mut tx = self.db.begin().await?;
        let sql = match function {
            WebFunction::Search => "UPDATE web_providers SET search_rank = ? WHERE id = ?",
            WebFunction::Fetch => "UPDATE web_providers SET fetch_rank = ? WHERE id = ?",
        };
        for (rank, id) in ids.iter().enumerate() {
            sqlx::query(sql)
                .bind(rank as i32)
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        self.list_web().await
    }

    /// Resolves enabled backends in fallback order, excluding keyless accounts.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Crypto`] when a stored key cannot be opened and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn web_backends(
        &self,
        function: WebFunction,
    ) -> Result<Vec<WebBackend>, ProviderError> {
        self.insert_missing_web().await?;
        let sql = match function {
            WebFunction::Search => {
                "SELECT id, kind, api_key, enabled, search_rank, fetch_rank
                 FROM web_providers
                 WHERE enabled = 1 AND api_key != '' AND kind != 'native'
                 ORDER BY search_rank ASC"
            }
            WebFunction::Fetch => {
                "SELECT id, kind, api_key, enabled, search_rank, fetch_rank
                 FROM web_providers
                 WHERE enabled = 1 AND (kind = 'native' OR api_key != '')
                 ORDER BY fetch_rank ASC"
            }
        };
        let tuples = sqlx::query_as::<_, WebTuple>(sql)
            .fetch_all(&self.db)
            .await?;
        let mut rows: Vec<WebRow> = tuples
            .into_iter()
            .map(web_row_from_tuple)
            .collect::<Result<_, _>>()?;
        rows.sort_by_key(|row| match function {
            WebFunction::Search => (row.search_rank, row.kind),
            WebFunction::Fetch => (row.fetch_rank, row.kind),
        });
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

    async fn insert_missing_web(&self) -> Result<(), ProviderError> {
        let now = Utc::now();
        for (kind, enabled, rank) in [
            (WebProviderKind::Native, true, 0_i32),
            (WebProviderKind::Exa, false, 1_i32),
            (WebProviderKind::DeepSeek, false, 2_i32),
        ] {
            sqlx::query(
                "INSERT INTO web_providers (
                     id, kind, api_key, enabled, search_rank, fetch_rank, created_at
                 )
                 VALUES (?, ?, '', ?, ?, ?, ?)
                 ON CONFLICT (kind) DO NOTHING",
            )
            .bind(Uuid::new_v4())
            .bind(kind.as_str())
            .bind(enabled)
            .bind(rank)
            .bind(rank)
            .bind(now)
            .execute(&self.db)
            .await?;
        }
        Ok(())
    }

    async fn web_rows(&self) -> Result<Vec<WebRow>, ProviderError> {
        let tuples = sqlx::query_as::<_, WebTuple>(
            "SELECT id, kind, api_key, enabled, search_rank, fetch_rank FROM web_providers",
        )
        .fetch_all(&self.db)
        .await?;
        tuples.into_iter().map(web_row_from_tuple).collect()
    }

    fn web_view(row: &WebRow) -> WebProviderView {
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
