//! Auth domain: signup, login, token refresh and rotation, generic over
//! an [`AuthStore`] backend.

mod auth_error;
mod auth_service;
mod auth_store;
mod jwt;
mod password;
mod record;
mod token;

pub use auth_error::{AuthError, AuthStoreError};
pub use auth_service::{AuthService, AuthTokens, REFRESH_TTL_DAYS, Session};
pub use auth_store::AuthStore;
pub use jwt::{ACCESS_TOKEN_TTL_SECS, Claims, sign_access_token, verify_access_token};
pub use password::{hash_password, verify_password};
pub use record::{RefreshToken, User};
pub use token::{generate_refresh_token, hash_token};
