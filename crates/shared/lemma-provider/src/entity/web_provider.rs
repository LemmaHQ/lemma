use sea_orm::entity::prelude::*;

/// A web search or fetch service supported by Lemma.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::None)")]
pub enum WebProviderKind {
    /// Local HTTP fetch without an account.
    #[sea_orm(string_value = "native")]
    Native,
    /// Exa search and fetch.
    #[sea_orm(string_value = "exa")]
    Exa,
    /// DeepSeek search and fetch.
    #[sea_orm(string_value = "deepseek")]
    DeepSeek,
}

/// A user's web backend configuration.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "web_providers")]
pub struct Model {
    /// Provider id.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Backend implementation.
    pub kind: WebProviderKind,
    /// API key sealed with lemma-crypto.
    pub api_key: String,
    /// Whether the backend is selectable.
    pub enabled: bool,
    /// Position in the search fallback order.
    pub search_rank: i32,
    /// Position in the fetch fallback order.
    pub fetch_rank: i32,
    /// Creation time.
    pub created_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}
