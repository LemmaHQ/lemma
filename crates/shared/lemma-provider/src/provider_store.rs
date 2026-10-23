//! Storage contract for provider records.

use uuid::Uuid;

use crate::provider_error::ProviderError;
use crate::record::{NewProvider, ProviderPatch, ProviderRecord};

/// Storage backend for provider records. Implemented by both db crates
/// (`PgProviderStore`, `SqliteProviderStore`) so the domain runs
/// identically on server and local modes. Clones share one connection
/// pool.
///
/// Every operation fails with [`ProviderError::Store`] when the backend
/// fails.
pub trait ProviderStore: Clone + Send + Sync + 'static {
    /// Inserts a provider for the user and returns the stored record.
    /// Fails with [`ProviderError::IdentifierTaken`] when the user already
    /// has a provider with the same identifier.
    fn insert(
        &self,
        user_id: Uuid,
        new: &NewProvider,
    ) -> impl Future<Output = Result<ProviderRecord, ProviderError>> + Send;

    /// Lists the user's providers in creation order.
    fn list(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<Vec<ProviderRecord>, ProviderError>> + Send;

    /// Finds a provider owned by the user.
    fn get(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<ProviderRecord>, ProviderError>> + Send;

    /// Applies a patch, returning the updated record or `None` for missing
    /// records owned by the user.
    fn update(
        &self,
        user_id: Uuid,
        id: Uuid,
        patch: &ProviderPatch,
    ) -> impl Future<Output = Result<Option<ProviderRecord>, ProviderError>> + Send;

    /// Deletes a provider owned by the user, returning whether a row was
    /// removed.
    fn delete(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<bool, ProviderError>> + Send;
}
