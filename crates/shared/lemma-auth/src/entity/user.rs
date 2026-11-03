use sea_orm::entity::prelude::*;

/// A registered account.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    /// User id.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Sign-in name.
    #[sea_orm(unique)]
    pub username: String,
    /// Contact email.
    #[sea_orm(unique)]
    pub email: String,
    /// Creation time.
    pub created_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}
