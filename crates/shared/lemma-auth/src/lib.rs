//! Auth domain: signup, login, token refresh and rotation over the auth
//! tables, which this crate defines and migrates.

mod auth_error;
mod auth_service;
mod entity;
mod jwt;
mod migration;
mod password;
mod token;

pub use auth_error::AuthError;
pub use auth_service::{AuthService, AuthTokens, REFRESH_TTL_DAYS, SignedIn};
pub use entity::user::Model as User;
pub use jwt::{ACCESS_TOKEN_TTL_SECS, Claims, verify_access_token};
pub use migration::migrations;
