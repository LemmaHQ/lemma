//! Connect handler for the `SystemService`: facts about the running server,
//! answered without authentication.

use connectrpc::{RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{GetVersionRequest, GetVersionResponse};

/// Connect handler implementing the `SystemService` RPCs.
#[derive(Debug, Default)]
pub struct SystemRpc;

#[allow(refining_impl_trait)]
impl v1::SystemService for SystemRpc {
    async fn get_version(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, GetVersionRequest>,
    ) -> ServiceResult<GetVersionResponse> {
        Response::ok(GetVersionResponse {
            version: env!("CARGO_PKG_VERSION").to_owned(),
            ..Default::default()
        })
    }
}
