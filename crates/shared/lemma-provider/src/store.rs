//! Storage contract for provider records.

use std::future::Future;
use std::pin::Pin;

use uuid::Uuid;

use crate::error::ProviderError;
use crate::record::{NewProvider, ProviderPatch, ProviderRecord};

/// Future returned by asynchronous provider store operations.
pub type BoxProviderFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, ProviderError>> + Send + 'a>>;

/// Storage backend for provider records. Implemented by both db crates
/// (`PgProviderStore`, `SqliteProviderStore`) so the domain runs
/// identically on server and local modes.
pub trait ProviderStore: Send + Sync {
    /// Inserts a provider for the user and returns the stored record.
    fn insert<'a>(
        &'a self,
        user_id: Uuid,
        new: &'a NewProvider,
    ) -> BoxProviderFuture<'a, ProviderRecord>;

    /// Lists the user's providers in creation order.
    fn list<'a>(&'a self, user_id: Uuid) -> BoxProviderFuture<'a, Vec<ProviderRecord>>;

    /// Finds a provider owned by the user.
    fn get<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, Option<ProviderRecord>>;

    /// Applies a patch, returning the updated record or `None` when the
    /// provider does not exist for this user.
    fn update<'a>(
        &'a self,
        user_id: Uuid,
        id: Uuid,
        patch: ProviderPatch,
    ) -> BoxProviderFuture<'a, Option<ProviderRecord>>;

    /// Deletes a provider owned by the user, returning whether a row was
    /// removed.
    fn delete<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, bool>;
}
