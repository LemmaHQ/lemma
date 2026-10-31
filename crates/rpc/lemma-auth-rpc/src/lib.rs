//! Connect RPC shell for the `AuthService`: cookie handling,
//! `require_user` authentication, and proto mapping. All behavior lives
//! in `lemma-auth`.

mod auth_rpc;
mod request_auth;

pub use auth_rpc::AuthRpc;
pub use request_auth::require_user;
