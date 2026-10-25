use sea_orm::entity::prelude::*;

/// An account's password hash.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "auth_credentials")]
pub struct Model {
    /// Owning user.
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: Uuid,
    /// Argon2 hash of the password.
    pub password_hash: String,
}

impl ActiveModelBehavior for ActiveModel {}
