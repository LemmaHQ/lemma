//! Auth business flows: signup, login, token refresh and rotation over a
//! database.

use std::fmt::{self, Debug};

use chrono::{Duration, Utc};
use sea_orm::sea_query::{Expr, IntoCondition};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, ConnectionTrait, DatabaseConnection, EntityTrait,
    FromQueryResult, JoinType, QueryFilter, QuerySelect, RelationDef, Set, SqlErr,
    TransactionTrait,
};
use uuid::Uuid;

use crate::User;
use crate::auth_error::AuthError;
use crate::entity::{auth_credential, refresh_token, user};
use crate::password::{hash_password, verify_password};
use crate::{jwt, token};

/// Lifetime of a refresh token: 30 days.
pub const REFRESH_TTL_DAYS: i64 = 30;

/// A freshly issued access + refresh token pair.
#[derive(Debug, Clone)]
pub struct AuthTokens {
    /// Signed access token.
    pub access_token: String,
    /// Plaintext refresh token; only its hash is stored.
    pub refresh_token: String,
}

/// An authenticated session: the account plus its issued tokens.
#[derive(Debug, Clone)]
pub struct Session {
    /// The authenticated account.
    pub user: User,
    /// Issued tokens.
    pub tokens: AuthTokens,
}

/// Auth domain service over a database holding the auth tables.
pub struct AuthService {
    db: DatabaseConnection,
    secret: String,
}

impl Debug for AuthService {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AuthService")
            .field("db", &self.db)
            .finish_non_exhaustive()
    }
}

#[derive(FromQueryResult)]
struct Credentialed {
    #[sea_orm(nested)]
    user: User,
    password_hash: String,
}

fn matches_login(login: &str) -> Condition {
    Condition::any()
        .add(user::Column::Username.eq(login))
        .add(user::Column::Email.eq(login))
}

async fn revoke<C: ConnectionTrait, F: IntoCondition>(db: &C, scope: F) -> Result<u64, AuthError> {
    let result = refresh_token::Entity::update_many()
        .col_expr(refresh_token::Column::RevokedAt, Expr::value(Utc::now()))
        .filter(scope)
        .filter(refresh_token::Column::RevokedAt.is_null())
        .exec(db)
        .await?;
    Ok(result.rows_affected)
}

impl AuthService {
    /// Creates the service. `secret` signs and verifies access tokens.
    #[must_use]
    pub fn new(db: DatabaseConnection, secret: String) -> Self {
        Self { db, secret }
    }

    async fn issue_tokens<C: ConnectionTrait>(
        &self,
        db: &C,
        user_id: Uuid,
        family_id: Uuid,
    ) -> Result<AuthTokens, AuthError> {
        let access_token =
            jwt::sign_access_token(&self.secret, user_id).map_err(AuthError::Sign)?;
        let plaintext = token::generate_refresh_token();
        let now = Utc::now();
        refresh_token::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            family_id: Set(family_id),
            token_hash: Set(token::hash_token(&plaintext)),
            revoked_at: Set(None),
            expires_at: Set(now + Duration::days(REFRESH_TTL_DAYS)),
        }
        .insert(db)
        .await?;
        Ok(AuthTokens {
            access_token,
            refresh_token: plaintext,
        })
    }

    /// Registers a new account and opens a session.
    ///
    /// # Errors
    ///
    /// [`AuthError::SignupFieldsRequired`] for a blank username or email or
    /// a password under 8 characters, [`AuthError::UsernameTaken`] for a
    /// registered username, [`AuthError::EmailTaken`] for a registered
    /// email, [`AuthError::Hash`] or [`AuthError::Sign`] when hashing or
    /// signing fails, and [`AuthError::Store`] when the database fails.
    pub async fn sign_up(
        &self,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<Session, AuthError> {
        let username = username.trim();
        let email = email.trim();
        if username.is_empty() || email.is_empty() || password.len() < 8 {
            return Err(AuthError::SignupFieldsRequired);
        }
        let password_hash = hash_password(password).map_err(AuthError::Hash)?;
        let tx = self.db.begin().await?;
        let inserted = user::ActiveModel {
            id: Set(Uuid::new_v4()),
            username: Set(username.to_owned()),
            email: Set(email.to_owned()),
            created_at: Set(Utc::now()),
        }
        .insert(&tx)
        .await;
        let user = match inserted {
            Ok(user) => user,
            Err(e) if matches!(e.sql_err(), Some(SqlErr::UniqueConstraintViolation(_))) => {
                tx.rollback().await?;
                return Err(self.conflict(username, email).await?);
            }
            Err(e) => return Err(e.into()),
        };
        auth_credential::ActiveModel {
            user_id: Set(user.id),
            password_hash: Set(password_hash),
        }
        .insert(&tx)
        .await?;
        let tokens = self.issue_tokens(&tx, user.id, Uuid::new_v4()).await?;
        tx.commit().await?;
        Ok(Session { user, tokens })
    }

    /// Names the field a rejected signup collides with, the username first.
    async fn conflict(&self, username: &str, email: &str) -> Result<AuthError, AuthError> {
        let existing = user::Entity::find()
            .filter(
                Condition::any()
                    .add(user::Column::Username.eq(username))
                    .add(user::Column::Email.eq(email)),
            )
            .all(&self.db)
            .await?;
        Ok(
            if existing.iter().any(|account| account.username == username) {
                AuthError::UsernameTaken
            } else {
                AuthError::EmailTaken
            },
        )
    }

    async fn find_by_login(&self, login: &str) -> Result<Option<User>, AuthError> {
        Ok(user::Entity::find()
            .filter(matches_login(login))
            .one(&self.db)
            .await?)
    }

    /// Reports whether an account has `login` as its username or email.
    ///
    /// # Errors
    ///
    /// [`AuthError::Store`] when the database fails.
    pub async fn account_exists(&self, login: &str) -> Result<bool, AuthError> {
        Ok(self.find_by_login(login.trim()).await?.is_some())
    }

    /// Authenticates by username or email and opens a session.
    ///
    /// # Errors
    ///
    /// [`AuthError::CredentialsInvalid`] for an unknown login or a wrong
    /// password, [`AuthError::Sign`] when signing fails, and
    /// [`AuthError::Store`] when the database fails.
    pub async fn login(&self, login: &str, password: &str) -> Result<Session, AuthError> {
        let credential: RelationDef = auth_credential::Entity::belongs_to(user::Entity)
            .from(auth_credential::Column::UserId)
            .to(user::Column::Id)
            .into();
        let Some(Credentialed {
            user,
            password_hash,
        }) = user::Entity::find()
            .join(JoinType::InnerJoin, credential.rev())
            .column(auth_credential::Column::PasswordHash)
            .filter(matches_login(login.trim()))
            .into_model::<Credentialed>()
            .one(&self.db)
            .await?
        else {
            return Err(AuthError::CredentialsInvalid);
        };
        if !verify_password(password, &password_hash) {
            return Err(AuthError::CredentialsInvalid);
        }
        let tokens = self.issue_tokens(&self.db, user.id, Uuid::new_v4()).await?;
        Ok(Session { user, tokens })
    }

    /// Rotates a refresh token and returns a fresh token pair. A rotated
    /// or revoked token presented again means theft: every token of its
    /// family is revoked.
    ///
    /// # Errors
    ///
    /// [`AuthError::TokenInvalid`] for an unknown, expired, rotated, or
    /// revoked token, [`AuthError::Sign`] when signing fails, and
    /// [`AuthError::Store`] when the database fails.
    pub async fn refresh(&self, presented: &str) -> Result<AuthTokens, AuthError> {
        let row = refresh_token::Entity::find()
            .filter(refresh_token::Column::TokenHash.eq(token::hash_token(presented)))
            .one(&self.db)
            .await?
            .ok_or(AuthError::TokenInvalid)?;
        if row.revoked_at.is_none() && row.expires_at <= Utc::now() {
            return Err(AuthError::TokenInvalid);
        }
        let tx = self.db.begin().await?;
        if revoke(&tx, refresh_token::Column::Id.eq(row.id)).await? == 0 {
            revoke(&tx, refresh_token::Column::FamilyId.eq(row.family_id)).await?;
            tx.commit().await?;
            return Err(AuthError::TokenInvalid);
        }
        let tokens = self.issue_tokens(&tx, row.user_id, row.family_id).await?;
        tx.commit().await?;
        Ok(tokens)
    }

    /// Revokes the presented refresh token, when it exists.
    ///
    /// # Errors
    ///
    /// [`AuthError::Store`] when the database fails.
    pub async fn logout(&self, presented: Option<&str>) -> Result<(), AuthError> {
        let Some(plaintext) = presented else {
            return Ok(());
        };
        revoke(
            &self.db,
            refresh_token::Column::TokenHash.eq(token::hash_token(plaintext)),
        )
        .await?;
        Ok(())
    }

    /// Returns the account for an authenticated user id.
    ///
    /// # Errors
    ///
    /// [`AuthError::UserNotFound`] for an unknown id and
    /// [`AuthError::Store`] when the database fails.
    pub async fn me(&self, user_id: Uuid) -> Result<User, AuthError> {
        user::Entity::find_by_id(user_id)
            .one(&self.db)
            .await?
            .ok_or(AuthError::UserNotFound)
    }
}
