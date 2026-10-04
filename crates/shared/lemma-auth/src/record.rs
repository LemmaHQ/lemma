//! Domain types for accounts and refresh tokens. Each backend maps its
//! own row representation onto these types.

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// A registered account.
#[derive(Debug, Clone)]
pub struct User {
    /// User id.
    pub id: Uuid,
    /// Login name.
    pub username: String,
    /// Contact email.
    pub email: String,
    /// Role string: `owner` or `normal`.
    pub role: String,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

/// A stored refresh token. Only the SHA-256 hash of the plaintext token
/// is persisted.
#[derive(Debug, Clone)]
pub struct RefreshToken {
    /// Token id.
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// SHA-256 hash of the plaintext token.
    pub token_hash: String,
    /// Optional user-facing label.
    pub label: Option<String>,
    /// Rotation successor, set when the token was consumed by a refresh.
    pub replaced_by: Option<Uuid>,
    /// Revocation time, if revoked.
    pub revoked_at: Option<DateTime<Utc>>,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Expiry time.
    pub expires_at: DateTime<Utc>,
}
