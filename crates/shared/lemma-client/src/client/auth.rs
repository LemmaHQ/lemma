use std::fmt;
use std::sync::Arc;

use axum::Router;
use connectrpc::client::{CallOptions, ClientConfig};
use connectrpc::{ConnectError, ErrorCode};
use http::Uri;
use http::header::AUTHORIZATION;
use lemma_proto::lemma::v1::{
    AgentServiceClient, AuthServiceClient, AuthTokens, CheckAccountRequest, GetVersionRequest,
    MeRequest, ProviderServiceClient, RefreshRequest, SessionServiceClient, SignInRequest,
    SignOutRequest, SignUpRequest, SystemServiceClient, User,
};

use crate::client_error::ClientError;
use crate::connection::{Connection, parse_remote};
use crate::token_pair::TokenPair;
use crate::token_state::TokenState;
use crate::token_store::TokenStore;
use crate::transport::Transport;

const ENGINE_URL: &str = "http://engine.lemma.invalid";
const CLIENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// One connection to a Lemma host: every service, with the connection's tokens attached and refreshed.
pub struct Client<S> {
    pub(super) inner: Arc<Services<S>>,
}

pub(super) struct Services<S> {
    pub(super) auth: AuthServiceClient<Transport>,
    pub(super) sessions: SessionServiceClient<Transport>,
    pub(super) providers: ProviderServiceClient<Transport>,
    pub(super) agent: AgentServiceClient<Transport>,
    system: SystemServiceClient<Transport>,
    tokens: TokenState<S>,
}

impl<S: TokenStore> Client<S> {
    /// A client of the local engine, served in process by `router`, with the local connection's stored tokens.
    pub fn local(router: Router, store: S) -> Self {
        let base = Uri::from_static(ENGINE_URL);
        Self::connect(
            Transport::in_process(router),
            base,
            Connection::Local,
            store,
        )
    }

    /// A client of the server at `url`, after it reports the same version as this client.
    ///
    /// # Errors
    ///
    /// [`ClientError::UrlInvalid`] for a URL that is not absolute `http` or `https`,
    /// [`ClientError::VersionMismatch`] when the server runs another version,
    /// [`ClientError::Tls`] when TLS cannot be set up, and the version call's error.
    pub async fn remote(url: &str, store: S) -> Result<Self, ClientError> {
        let (url, base) = parse_remote(url)?;
        let transport = Transport::remote(&base)?;
        let client = Self::connect(transport, base, Connection::Remote(url), store);
        let server = client.server_version().await?;
        if server != CLIENT_VERSION {
            return Err(ClientError::VersionMismatch {
                server,
                client: CLIENT_VERSION.to_owned(),
            });
        }
        Ok(client)
    }

    fn connect(transport: Transport, base: Uri, connection: Connection, store: S) -> Self {
        let config = ClientConfig::new(base);
        Self {
            inner: Arc::new(Services {
                auth: AuthServiceClient::new(transport.clone(), config.clone()),
                sessions: SessionServiceClient::new(transport.clone(), config.clone()),
                providers: ProviderServiceClient::new(transport.clone(), config.clone()),
                agent: AgentServiceClient::new(transport.clone(), config.clone()),
                system: SystemServiceClient::new(transport, config),
                tokens: TokenState::load(store, connection),
            }),
        }
    }

    /// The connection this client calls.
    #[must_use]
    pub fn connection(&self) -> &Connection {
        self.inner.tokens.connection()
    }

    /// Whether the connection holds tokens; a rejected refresh clears them.
    #[must_use]
    pub fn signed_in(&self) -> bool {
        self.inner.tokens.pair().is_some()
    }

    /// The version the host reports.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn server_version(&self) -> Result<String, ClientError> {
        let response = self.inner.system.get_version(GetVersionRequest::default());
        Ok(response.await?.into_owned().version)
    }

    /// Whether an account with this username or email exists, the first step of signing in.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn check_account(&self, identifier: &str) -> Result<bool, ClientError> {
        let request = CheckAccountRequest {
            identifier: identifier.trim().to_owned(),
            ..Default::default()
        };
        Ok(self
            .inner
            .auth
            .check_account(request)
            .await?
            .into_owned()
            .exists)
    }

    /// Signs in with a username or email and keeps the issued tokens.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`], or [`ClientError::Storage`] when the tokens cannot be stored.
    pub async fn sign_in(&self, identifier: &str, password: &str) -> Result<User, ClientError> {
        let request = SignInRequest {
            identifier: identifier.trim().to_owned(),
            password: password.to_owned(),
            ..Default::default()
        };
        let response = self.inner.auth.sign_in(request).await?.into_owned();
        self.keep(response.tokens.into_option().unwrap_or_default())?;
        Ok(response.user.into_option().unwrap_or_default())
    }

    /// Creates an account, signed in with the issued tokens.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`], or [`ClientError::Storage`] when the tokens cannot be stored.
    pub async fn sign_up(
        &self,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<User, ClientError> {
        let request = SignUpRequest {
            username: username.trim().to_owned(),
            email: email.trim().to_owned(),
            password: password.to_owned(),
            ..Default::default()
        };
        let response = self.inner.auth.sign_up(request).await?.into_owned();
        self.keep(response.tokens.into_option().unwrap_or_default())?;
        Ok(response.user.into_option().unwrap_or_default())
    }

    /// Forgets the tokens, then revokes the refresh token on the host.
    ///
    /// # Errors
    ///
    /// [`ClientError::Storage`] when the stored tokens cannot be removed, or the revocation call's error;
    /// the tokens are gone either way.
    pub async fn sign_out(&self) -> Result<(), ClientError> {
        let pair = self.inner.tokens.pair();
        self.inner.tokens.clear()?;
        let Some(pair) = pair else {
            return Ok(());
        };
        let request = SignOutRequest {
            refresh_token: pair.refresh_token,
            ..Default::default()
        };
        self.inner.auth.sign_out(request).await?;
        Ok(())
    }

    /// The signed-in user.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`]; [`ClientError::SignedOut`] once the tokens are gone.
    pub async fn me(&self) -> Result<User, ClientError> {
        let auth = &self.inner.auth;
        let response = self
            .authorized(|options| auth.me_with_options(MeRequest::default(), options))
            .await?;
        Ok(response.into_owned().user.into_option().unwrap_or_default())
    }

    /// Runs `rpc` with the access token; on an authentication failure, refreshes the tokens once and retries.
    pub(crate) async fn authorized<R, Call>(
        &self,
        rpc: impl Fn(CallOptions) -> Call,
    ) -> Result<R, ClientError>
    where
        Call: Future<Output = Result<R, ConnectError>>,
    {
        let sent = self.access_token();
        match rpc(bearer(sent.as_deref())).await {
            Err(error) if error.code == ErrorCode::Unauthenticated => {
                let token = self.refresh(sent.as_deref()).await?;
                Ok(rpc(bearer(Some(&token))).await?)
            }
            result => Ok(result?),
        }
    }

    pub(crate) fn access_token(&self) -> Option<String> {
        self.inner.tokens.access_token()
    }

    /// The access token to retry with: the current one when another call already replaced `sent`, else a refreshed one.
    /// A refresh the host rejects signs the connection out; a server or network failure keeps the tokens.
    pub(crate) async fn refresh(&self, sent: Option<&str>) -> Result<String, ClientError> {
        let _gate = self.inner.tokens.refresh_gate().await;
        let Some(pair) = self.inner.tokens.pair() else {
            return Err(ClientError::SignedOut);
        };
        if sent != Some(pair.access_token.as_str()) {
            return Ok(pair.access_token);
        }
        let request = RefreshRequest {
            refresh_token: pair.refresh_token,
            ..Default::default()
        };
        match self.inner.auth.refresh(request).await {
            Ok(response) => self.keep(
                response
                    .into_owned()
                    .tokens
                    .into_option()
                    .unwrap_or_default(),
            ),
            Err(error) if error.http_status().is_server_error() => Err(error.into()),
            Err(_) => {
                self.inner.tokens.clear()?;
                Err(ClientError::SignedOut)
            }
        }
    }

    fn keep(&self, tokens: AuthTokens) -> Result<String, ClientError> {
        let access_token = tokens.access_token.clone();
        self.inner.tokens.keep(TokenPair {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
        })?;
        Ok(access_token)
    }
}

impl<S> Clone for Client<S> {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

impl<S: TokenStore> fmt::Debug for Client<S> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Client")
            .field("connection", self.connection())
            .finish_non_exhaustive()
    }
}

pub(super) fn bearer(token: Option<&str>) -> CallOptions {
    let options = CallOptions::default();
    let Some(token) = token else {
        return options;
    };
    options.with_header(AUTHORIZATION, format!("Bearer {token}"))
}
