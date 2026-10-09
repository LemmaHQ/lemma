//! UniFFI embedding surface: the local engine facade consumed in-process by
//! the Kotlin Multiplatform client, over the same domain services and SQLite
//! backend as the server mode.

use std::fmt;
use std::sync::Arc;

use lemma_auth::{AuthService, AuthTokens, Session, User};
use lemma_conversation::{Conversation, ConversationService, Message};
use lemma_db_sqlite::{SqliteAuthStore, SqliteConversationStore};
use uuid::Uuid;

uniffi::setup_scaffolding!();

/// Errors surfaced by the local engine facade.
#[derive(Debug, uniffi::Error)]
pub enum EngineError {
    /// A string id argument failed to parse as a UUID.
    InvalidId(String),
    /// The auth domain rejected the operation.
    Auth(String),
    /// The conversation domain rejected the operation.
    Conversation(String),
    /// The storage backend failed.
    Storage(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId(raw) => write!(f, "invalid id: {raw}"),
            Self::Auth(e) => write!(f, "auth: {e}"),
            Self::Conversation(e) => write!(f, "conversation: {e}"),
            Self::Storage(e) => write!(f, "storage: {e}"),
        }
    }
}

impl std::error::Error for EngineError {}

fn parse_id(raw: &str) -> Result<Uuid, EngineError> {
    Uuid::parse_str(raw).map_err(|_| EngineError::InvalidId(raw.to_owned()))
}

/// An account as seen by the mobile client.
#[derive(uniffi::Record)]
pub struct MobileUser {
    /// User id.
    pub id: String,
    /// Login name.
    pub username: String,
    /// Contact email.
    pub email: String,
    /// Role string: `owner` or `normal`.
    pub role: String,
}

impl From<User> for MobileUser {
    fn from(u: User) -> Self {
        Self {
            id: u.id.to_string(),
            username: u.username,
            email: u.email,
            role: u.role,
        }
    }
}

/// An authenticated session: the account plus its issued tokens.
#[derive(uniffi::Record)]
pub struct MobileSession {
    /// The authenticated account.
    pub user: MobileUser,
    /// Signed access token.
    pub access_token: String,
    /// Access-token expiry time, RFC 3339.
    pub access_token_expires_at: String,
    /// Plaintext refresh token.
    pub refresh_token: String,
}

impl From<Session> for MobileSession {
    fn from(s: Session) -> Self {
        Self {
            user: s.user.into(),
            access_token: s.tokens.access_token,
            access_token_expires_at: s.tokens.access_token_expires_at.to_rfc3339(),
            refresh_token: s.tokens.refresh_token,
        }
    }
}

/// A rotated access + refresh token pair.
#[derive(uniffi::Record)]
pub struct MobileTokens {
    /// Signed access token.
    pub access_token: String,
    /// Access-token expiry time, RFC 3339.
    pub access_token_expires_at: String,
    /// Plaintext refresh token.
    pub refresh_token: String,
}

impl From<AuthTokens> for MobileTokens {
    fn from(t: AuthTokens) -> Self {
        Self {
            access_token: t.access_token,
            access_token_expires_at: t.access_token_expires_at.to_rfc3339(),
            refresh_token: t.refresh_token,
        }
    }
}

/// A conversation summary.
#[derive(uniffi::Record)]
pub struct MobileConversation {
    /// Conversation id.
    pub id: String,
    /// Display title.
    pub title: String,
    /// Lifecycle status: `active` or `archived`.
    pub status: String,
    /// Last update time, RFC 3339.
    pub updated_at: String,
}

impl From<Conversation> for MobileConversation {
    fn from(c: Conversation) -> Self {
        Self {
            id: c.id.to_string(),
            title: c.title,
            status: c.status,
            updated_at: c.updated_at.to_rfc3339(),
        }
    }
}

/// A message in a conversation.
#[derive(uniffi::Record)]
pub struct MobileMessage {
    /// Message id.
    pub id: String,
    /// Parent message id; absent for roots.
    pub parent_id: Option<String>,
    /// Authoring role.
    pub role: String,
    /// Structured content payload as JSON.
    pub content_json: String,
    /// Provider id used, for assistant messages.
    pub provider_id: Option<String>,
    /// Model used, for assistant messages.
    pub model: Option<String>,
    /// Delivery status: `streaming`, `done`, `aborted`, or `error`.
    pub status: String,
    /// Failure reason when status is `error`.
    pub error: Option<String>,
    /// Creation time, RFC 3339.
    pub created_at: String,
}

impl From<Message> for MobileMessage {
    fn from(m: Message) -> Self {
        Self {
            id: m.id.to_string(),
            parent_id: m.parent_id.map(|id| id.to_string()),
            role: m.role,
            content_json: m.content_json.to_string(),
            provider_id: m.provider_id.map(|id| id.to_string()),
            model: m.model,
            status: m.status,
            error: m.error,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

/// One keyset page of messages, newest first.
#[derive(uniffi::Record)]
pub struct MessagePage {
    /// The page's messages.
    pub messages: Vec<MobileMessage>,
    /// Whether an older page exists.
    pub has_more: bool,
}

/// The embedded local engine: auth and conversation domain services over a
/// migrated SQLite pool.
#[derive(uniffi::Object)]
pub struct LemmaEngine {
    auth: AuthService,
    conversations: ConversationService,
}

#[uniffi::export(async_runtime = "tokio")]
impl LemmaEngine {
    /// Opens or creates the engine database at `<data_dir>/lemma.db`, runs
    /// migrations, and returns the ready engine. `jwt_secret` signs access
    /// tokens and is supplied by the caller's configuration.
    #[uniffi::constructor]
    pub async fn open(data_dir: String, jwt_secret: String) -> Result<Arc<Self>, EngineError> {
        let db_path = std::path::Path::new(&data_dir).join("lemma.db");
        let pool = lemma_db_sqlite::connect(&db_path)
            .await
            .map_err(|e| EngineError::Storage(e.to_string()))?;
        lemma_db_sqlite::migrate(&pool)
            .await
            .map_err(|e| EngineError::Storage(e.to_string()))?;
        let auth = AuthService::new(Arc::new(SqliteAuthStore::new(pool.clone())), jwt_secret);
        let conversations = ConversationService::new(Arc::new(SqliteConversationStore::new(pool)));
        Ok(Arc::new(Self {
            auth,
            conversations,
        }))
    }

    /// Registers a new account and opens a session.
    pub async fn sign_up(
        &self,
        username: String,
        email: String,
        password: String,
    ) -> Result<MobileSession, EngineError> {
        self.auth
            .sign_up(&username, &email, &password)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Auth(e.to_string()))
    }

    /// Authenticates by username or email and opens a session.
    pub async fn login(
        &self,
        login: String,
        password: String,
    ) -> Result<MobileSession, EngineError> {
        self.auth
            .login(&login, "", &password)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Auth(e.to_string()))
    }

    /// Rotates a refresh token and returns a fresh token pair.
    pub async fn refresh(&self, refresh_token: String) -> Result<MobileTokens, EngineError> {
        self.auth
            .refresh(&refresh_token)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Auth(e.to_string()))
    }

    /// Revokes the presented refresh token, when it exists.
    pub async fn logout(&self, refresh_token: Option<String>) -> Result<(), EngineError> {
        self.auth
            .logout(refresh_token.as_deref())
            .await
            .map_err(|e| EngineError::Auth(e.to_string()))
    }

    /// Returns the account for an authenticated user id.
    pub async fn me(&self, user_id: String) -> Result<MobileUser, EngineError> {
        self.auth
            .me(parse_id(&user_id)?)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Auth(e.to_string()))
    }

    /// Creates an empty conversation for the user.
    pub async fn create_conversation(
        &self,
        user_id: String,
    ) -> Result<MobileConversation, EngineError> {
        self.conversations
            .create(parse_id(&user_id)?)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Lists the user's active conversations.
    pub async fn list_conversations(
        &self,
        user_id: String,
    ) -> Result<Vec<MobileConversation>, EngineError> {
        self.conversations
            .list_conversations(parse_id(&user_id)?)
            .await
            .map(|cs| cs.into_iter().map(Into::into).collect())
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Lists the user's archived conversations.
    pub async fn list_archived(
        &self,
        user_id: String,
    ) -> Result<Vec<MobileConversation>, EngineError> {
        self.conversations
            .list_archived(parse_id(&user_id)?)
            .await
            .map(|cs| cs.into_iter().map(Into::into).collect())
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Renames a conversation owned by the user.
    pub async fn rename_conversation(
        &self,
        user_id: String,
        conversation_id: String,
        title: String,
    ) -> Result<MobileConversation, EngineError> {
        self.conversations
            .rename(parse_id(&user_id)?, parse_id(&conversation_id)?, &title)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Archives an active conversation owned by the user.
    pub async fn archive_conversation(
        &self,
        user_id: String,
        conversation_id: String,
    ) -> Result<MobileConversation, EngineError> {
        self.conversations
            .archive(parse_id(&user_id)?, parse_id(&conversation_id)?)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Restores an archived conversation owned by the user.
    pub async fn restore_conversation(
        &self,
        user_id: String,
        conversation_id: String,
    ) -> Result<MobileConversation, EngineError> {
        self.conversations
            .restore(parse_id(&user_id)?, parse_id(&conversation_id)?)
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Deletes an archived conversation owned by the user.
    pub async fn delete_archived_conversation(
        &self,
        user_id: String,
        conversation_id: String,
    ) -> Result<(), EngineError> {
        self.conversations
            .delete_archived(parse_id(&user_id)?, parse_id(&conversation_id)?)
            .await
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }

    /// Lists a conversation's messages newest-first with keyset pagination.
    /// `limit` of zero selects the domain default page size.
    pub async fn list_messages(
        &self,
        user_id: String,
        conversation_id: String,
        before_id: Option<String>,
        limit: i32,
    ) -> Result<MessagePage, EngineError> {
        let before = before_id.as_deref().map(parse_id).transpose()?;
        self.conversations
            .list_messages(
                parse_id(&user_id)?,
                parse_id(&conversation_id)?,
                before,
                limit,
            )
            .await
            .map(|(messages, has_more)| MessagePage {
                messages: messages.into_iter().map(Into::into).collect(),
                has_more,
            })
            .map_err(|e| EngineError::Conversation(e.to_string()))
    }
}
