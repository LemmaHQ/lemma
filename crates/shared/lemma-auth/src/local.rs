//! Default account of local mode: the open entry point shared by every
//! runtime hosting the engine, whether as a desktop sidecar or embedded
//! in-process on mobile.

/// Username of the default local account.
pub const DEFAULT_USERNAME: &str = "lemma";

/// Contact email of the default local account.
pub const DEFAULT_EMAIL: &str = "lemma@local";

/// Fixed passphrase of the default local account. It is public by design:
/// functioning as the open entry point for local mode. Accounts a user
/// registers individually carry private passwords.
pub const DEFAULT_PASSWORD: &str = "lemma-local-default";
