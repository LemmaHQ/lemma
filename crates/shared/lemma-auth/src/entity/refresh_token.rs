use sea_orm::entity::prelude::*;

/// A stored refresh token. Only the SHA-256 hash of the plaintext token
/// is persisted; a rotated or revoked token keeps its row with
/// `revoked_at` set.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "refresh_tokens")]
pub struct Model {
    /// Token id.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Shared by every token a login and its rotations issue.
    pub family_id: Uuid,
    /// SHA-256 hash of the plaintext token.
    #[sea_orm(unique)]
    pub token_hash: String,
    /// Rotation or revocation time, if the token was consumed.
    pub revoked_at: Option<DateTimeUtc>,
    /// Expiry time.
    pub expires_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}
