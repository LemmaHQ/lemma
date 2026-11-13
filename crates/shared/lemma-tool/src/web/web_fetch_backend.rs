use std::fmt::Debug;

use crate::tool::BoxToolFuture;

/// One provider capable of fetching a web page.
pub trait WebFetchBackend: Debug + Send + Sync {
    /// Returns the provider name included in normalized results.
    fn name(&self) -> &'static str;

    /// Fetches a URL and returns normalized result JSON.
    fn fetch<'exec>(&'exec self, url: String) -> BoxToolFuture<'exec>;
}
