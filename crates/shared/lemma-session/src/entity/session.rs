use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// The model selection last used in a session, stored as a JSON
/// column and restored when the session is reopened.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct LastModel {
    /// Provider the turn was dispatched to.
    pub provider_id: Uuid,
    /// Model identifier as configured on the provider.
    pub model: String,
}

/// A session owned by a user.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "sessions")]
pub struct Model {
    /// Session id.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Display title.
    pub title: String,
    /// Active branch leaf message id; `None` when empty.
    pub leaf_id: Option<Uuid>,
    /// Model last used in this session; `None` before the first turn.
    pub last_model: Option<LastModel>,
    /// Creation time.
    pub created_at: DateTimeUtc,
    /// Last update time.
    pub updated_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}
