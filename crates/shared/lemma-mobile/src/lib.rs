//! UniFFI embedding surface: the local engine facade consumed in-process by
//! the Kotlin Multiplatform client, over the same domain services and SQLite
//! backend as the server mode.

use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::{Agent, AgentError, TurnEnd, TurnEvent, TurnRequest};
use lemma_auth::local::{DEFAULT_EMAIL, DEFAULT_PASSWORD, DEFAULT_USERNAME};
use lemma_auth::{AuthService, AuthStore, AuthTokens, Session, User};
use lemma_conversation::{Conversation, ConversationService, ConversationStore, Message};
use lemma_db_sqlite::{SqliteAuthStore, SqliteConversationStore, SqliteProviderStore};
use lemma_model::{Connector, ProviderKind};
use lemma_provider::{CreateInput, ProviderService, ProviderView, UpdateInput};
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
    /// The provider domain rejected the operation.
    Provider(String),
    /// The agent execution failed.
    Agent(String),
    /// A request argument failed validation.
    Validation(String),
    /// The storage backend failed.
    Storage(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId(raw) => write!(f, "invalid id: {raw}"),
            Self::Auth(e) => write!(f, "auth: {e}"),
            Self::Conversation(e) => write!(f, "conversation: {e}"),
            Self::Provider(e) => write!(f, "provider: {e}"),
            Self::Agent(e) => write!(f, "agent: {e}"),
            Self::Validation(e) => write!(f, "validation: {e}"),
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
    /// Last update time, RFC 3339.
    pub updated_at: String,
}

impl From<Conversation> for MobileConversation {
    fn from(c: Conversation) -> Self {
        Self {
            id: c.id.to_string(),
            title: c.title,
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
    /// Visible text content, mirroring the server's presentation mapping.
    pub text: String,
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
    /// Creation time, seconds since the Unix epoch.
    pub created_at_seconds: i64,
}

fn visible_text(content: &serde_json::Value) -> String {
    content
        .as_array()
        .map(|blocks| {
            blocks
                .iter()
                .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
                .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                .collect()
        })
        .unwrap_or_default()
}

impl From<Message> for MobileMessage {
    fn from(m: Message) -> Self {
        let content_json = serde_json::to_value(&m.message).unwrap_or_default();
        Self {
            id: m.id.to_string(),
            parent_id: m.parent_id.map(|id| id.to_string()),
            role: m.role().to_string(),
            text: visible_text(&content_json),
            content_json: content_json.to_string(),
            provider_id: m.provider_id.map(|id| id.to_string()),
            model: m.model,
            status: m.status.as_str().to_string(),
            error: m.error,
            created_at_seconds: m.created_at.timestamp(),
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

/// A model provider configuration.
#[derive(uniffi::Record)]
pub struct MobileProvider {
    /// Provider id.
    pub id: String,
    /// Provider kind: `openai`, `anthropic`, or `gemini`.
    pub kind: String,
    /// User-facing machine identifier, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// Stored API key, empty when keyless.
    pub api_key: String,
    /// Cached model ids.
    pub models: Vec<String>,
    /// Enabled flag.
    pub enabled: bool,
    /// Generation endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
}

impl From<ProviderView> for MobileProvider {
    fn from(v: ProviderView) -> Self {
        Self {
            id: v.id.to_string(),
            kind: v.kind.as_str().to_string(),
            identifier: v.identifier,
            name: v.name,
            base_url: v.base_url,
            api_key: v.api_key,
            models: v.models,
            enabled: v.enabled,
            api_path: v.api_path,
            models_path: v.models_path,
        }
    }
}

/// Patch input for updating a provider; absent fields keep current values.
#[derive(uniffi::Record)]
pub struct ProviderUpdate {
    /// Display name.
    pub name: Option<String>,
    /// API base URL.
    pub base_url: Option<String>,
    /// Plaintext replacement API key.
    pub api_key: Option<String>,
    /// Generation endpoint path override.
    pub api_path: Option<String>,
    /// Model-list endpoint path override.
    pub models_path: Option<String>,
    /// Enabled flag.
    pub enabled: Option<bool>,
    /// Model ids to cache.
    pub models: Option<Vec<String>>,
}

impl From<ProviderUpdate> for UpdateInput {
    fn from(p: ProviderUpdate) -> Self {
        Self {
            name: p.name,
            base_url: p.base_url,
            api_key: p.api_key,
            api_path: p.api_path,
            models_path: p.models_path,
            enabled: p.enabled,
            models: p.models,
        }
    }
}

/// One streamed event of an agent turn.
#[derive(Debug, uniffi::Enum)]
pub enum MobileAgentEvent {
    /// The user message has been committed.
    Started {
        /// User message id.
        message_id: String,
    },
    /// A new assistant message node started streaming.
    TurnStarted {
        /// Assistant message id.
        message_id: String,
    },
    /// An incremental text chunk.
    Delta {
        /// Incremental chunk.
        text: String,
    },
    /// An incremental reasoning chunk.
    ThinkingDelta {
        /// Incremental reasoning chunk.
        text: String,
    },
    /// A tool call is about to execute.
    ToolStarted {
        /// Provider-assigned call id.
        id: String,
        /// Tool name.
        name: String,
        /// Call arguments as serialized JSON.
        arguments: String,
    },
    /// A tool call finished executing.
    ToolFinished {
        /// Provider-assigned call id.
        id: String,
        /// Tool name.
        name: String,
        /// Tool output text.
        content: String,
        /// True when the tool reported a failure.
        is_error: bool,
    },
    /// The turn completed and the assistant message persisted.
    Done {
        /// Assistant message id.
        message_id: String,
        /// Prompt tokens consumed, zero when unreported.
        input_tokens: i64,
        /// Response tokens produced, zero when unreported.
        output_tokens: i64,
    },
    /// The turn was aborted by the user.
    Aborted,
    /// The turn failed.
    Error {
        /// Failure description.
        message: String,
    },
}

/// Receives streamed agent turn events on the Kotlin side.
#[uniffi::export(foreign)]
pub trait AgentEventListener: Send + Sync {
    /// Delivers one streamed turn event.
    fn on_event(&self, event: MobileAgentEvent);
}

fn prepare_error(e: AgentError) -> EngineError {
    match e {
        AgentError::ContentRequired | AgentError::ModelRequired => {
            EngineError::Validation(e.to_string())
        }
        AgentError::Store(_) | AgentError::Workspace(_) => EngineError::Storage(e.to_string()),
        AgentError::ProviderNotFound | AgentError::Provider(_) => {
            EngineError::Provider(e.to_string())
        }
        AgentError::Loop(_) => EngineError::Agent(e.to_string()),
    }
}

fn map_event(ev: TurnEvent) -> MobileAgentEvent {
    match ev {
        TurnEvent::UserAppended { id } => MobileAgentEvent::Started {
            message_id: id.to_string(),
        },
        TurnEvent::AssistantStarted { id } => MobileAgentEvent::TurnStarted {
            message_id: id.to_string(),
        },
        TurnEvent::Delta { delta } => MobileAgentEvent::Delta { text: delta },
        TurnEvent::ThinkingDelta { delta } => MobileAgentEvent::ThinkingDelta { text: delta },
        TurnEvent::ToolStarted {
            id,
            name,
            arguments,
        } => MobileAgentEvent::ToolStarted {
            id,
            name,
            arguments,
        },
        TurnEvent::ToolFinished {
            id,
            name,
            content,
            is_error,
        } => MobileAgentEvent::ToolFinished {
            id,
            name,
            content,
            is_error,
        },
        TurnEvent::AssistantDone { id, usage, .. } => MobileAgentEvent::Done {
            message_id: id.to_string(),
            input_tokens: usage.map_or(0, |u| u.input),
            output_tokens: usage.map_or(0, |u| u.output),
        },
    }
}

/// The embedded local engine: auth, conversation, provider, and agent
/// domain services over a migrated SQLite pool.
#[derive(uniffi::Object)]
pub struct LemmaEngine {
    auth: AuthService,
    auth_store: Arc<SqliteAuthStore>,
    conversations: ConversationService,
    providers: Arc<ProviderService>,
    agent: Agent,
}

#[uniffi::export(async_runtime = "tokio")]
impl LemmaEngine {
    /// Opens or creates the engine database at `<data_dir>/lemma.db`, runs
    /// migrations, and returns the ready engine. `jwt_secret` signs access
    /// tokens and is supplied by the caller's configuration.
    #[uniffi::constructor]
    pub async fn open(data_dir: String, jwt_secret: String) -> Result<Arc<Self>, EngineError> {
        let data_dir = std::path::PathBuf::from(data_dir);
        let pool = lemma_db_sqlite::connect(&data_dir.join("lemma.db"))
            .await
            .map_err(|e| EngineError::Storage(e.to_string()))?;
        lemma_db_sqlite::migrate(&pool)
            .await
            .map_err(|e| EngineError::Storage(e.to_string()))?;
        let auth_store = Arc::new(SqliteAuthStore::new(pool.clone()));
        let auth = AuthService::new(auth_store.clone(), jwt_secret);
        let store: Arc<dyn ConversationStore> =
            Arc::new(SqliteConversationStore::new(pool.clone()));
        let conversations = ConversationService::new(Arc::clone(&store));
        let connector: Arc<dyn Connector> =
            Arc::new(HttpConnector::new(Arc::new(ReqwestTransport::new())));
        let providers = Arc::new(ProviderService::new(
            Arc::new(SqliteProviderStore::new(pool.clone())),
            None,
            Arc::clone(&connector),
        ));
        let agent = Agent::new(
            store,
            Arc::clone(&providers),
            connector,
            Some(data_dir.join("workspaces")),
        );
        Ok(Arc::new(Self {
            auth,
            auth_store,
            conversations,
            providers,
            agent,
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

    /// Opens a session on the default local account, provisioning it on
    /// first use. Shared by every local-mode runtime.
    pub async fn use_default_account(&self) -> Result<MobileSession, EngineError> {
        if self
            .auth_store
            .find_user_by_login(DEFAULT_USERNAME)
            .await
            .map_err(|e| EngineError::Storage(e.to_string()))?
            .is_none()
        {
            self.auth
                .sign_up(DEFAULT_USERNAME, DEFAULT_EMAIL, DEFAULT_PASSWORD)
                .await
                .map_err(|e| EngineError::Auth(e.to_string()))?;
        }
        self.auth
            .login(DEFAULT_USERNAME, "", DEFAULT_PASSWORD)
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

    /// Lists the user's conversations.
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

    /// Permanently deletes a conversation owned by the user together with
    /// its messages.
    pub async fn delete_conversation(
        &self,
        user_id: String,
        conversation_id: String,
    ) -> Result<(), EngineError> {
        self.conversations
            .delete(parse_id(&user_id)?, parse_id(&conversation_id)?)
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

    /// Lists the user's provider configurations.
    pub async fn list_providers(
        &self,
        user_id: String,
    ) -> Result<Vec<MobileProvider>, EngineError> {
        self.providers
            .list(parse_id(&user_id)?)
            .await
            .map(|ps| ps.into_iter().map(Into::into).collect())
            .map_err(|e| EngineError::Provider(e.to_string()))
    }

    /// Validates and stores a new provider configuration.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_provider(
        &self,
        user_id: String,
        kind: String,
        identifier: String,
        name: String,
        base_url: String,
        api_key: String,
        api_path: String,
        models_path: String,
        models: Vec<String>,
    ) -> Result<MobileProvider, EngineError> {
        let kind = ProviderKind::from_str(&kind)
            .map_err(|()| EngineError::Validation(format!("unknown provider kind: {kind}")))?;
        self.providers
            .create(
                parse_id(&user_id)?,
                CreateInput {
                    kind,
                    identifier,
                    name,
                    base_url,
                    api_key,
                    api_path,
                    models_path,
                    models,
                },
            )
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Provider(e.to_string()))
    }

    /// Applies a patch to a provider owned by the user.
    pub async fn update_provider(
        &self,
        user_id: String,
        provider_id: String,
        patch: ProviderUpdate,
    ) -> Result<MobileProvider, EngineError> {
        self.providers
            .update(parse_id(&user_id)?, parse_id(&provider_id)?, patch.into())
            .await
            .map(Into::into)
            .map_err(|e| EngineError::Provider(e.to_string()))
    }

    /// Deletes a provider owned by the user.
    pub async fn delete_provider(
        &self,
        user_id: String,
        provider_id: String,
    ) -> Result<(), EngineError> {
        self.providers
            .delete(parse_id(&user_id)?, parse_id(&provider_id)?)
            .await
            .map_err(|e| EngineError::Provider(e.to_string()))
    }

    /// Fetches the live model list using a stored provider's key.
    pub async fn fetch_provider_models(
        &self,
        user_id: String,
        provider_id: String,
    ) -> Result<Vec<String>, EngineError> {
        self.providers
            .fetch_models_for(parse_id(&user_id)?, parse_id(&provider_id)?)
            .await
            .map_err(|e| EngineError::Provider(e.to_string()))
    }

    /// Fetches the live model list for ad-hoc connection details.
    pub async fn fetch_models(
        &self,
        kind: String,
        base_url: String,
        api_key: String,
        models_path: String,
    ) -> Result<Vec<String>, EngineError> {
        let kind = ProviderKind::from_str(&kind)
            .map_err(|()| EngineError::Validation(format!("unknown provider kind: {kind}")))?;
        self.providers
            .fetch_models_adhoc(kind, &base_url, &api_key, &models_path)
            .await
            .map_err(|e| EngineError::Provider(e.to_string()))
    }

    /// Aborts the user's running turn started by `message_id`; a turn that
    /// is not running is a no-op.
    pub fn abort_message(&self, user_id: String, message_id: String) -> Result<(), EngineError> {
        self.agent
            .abort(parse_id(&user_id)?, parse_id(&message_id)?);
        Ok(())
    }

    /// Runs one agent turn: appends the user message, streams model and tool
    /// events to `listener`, and persists the settled assistant messages.
    /// The stream terminates with a `Done`, `Aborted`, or `Error` event.
    #[allow(clippy::too_many_arguments)]
    pub async fn send_message(
        &self,
        user_id: String,
        conversation_id: String,
        content: String,
        provider_id: String,
        model: String,
        thinking_effort: Option<String>,
        listener: Arc<dyn AgentEventListener>,
    ) -> Result<(), EngineError> {
        let turn = self
            .agent
            .prepare(TurnRequest {
                user_id: parse_id(&user_id)?,
                conversation_id: parse_id(&conversation_id)?,
                provider_id: parse_id(&provider_id)?,
                model,
                content,
                thinking_effort,
            })
            .await
            .map_err(prepare_error)?;
        match turn.run(|ev| listener.on_event(map_event(ev))).await {
            Ok(TurnEnd::Done) => {}
            Ok(TurnEnd::Aborted) => listener.on_event(MobileAgentEvent::Aborted),
            Err(e) => listener.on_event(MobileAgentEvent::Error {
                message: e.to_string(),
            }),
        }
        Ok(())
    }
}
