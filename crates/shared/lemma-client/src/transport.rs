use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use connectrpc::ConnectError;
use connectrpc::client::{BoxFuture, ClientBody, ClientTransport, HttpClient, ServiceTransport};
use connectrpc::rustls::ClientConfig;
use connectrpc::rustls::crypto::aws_lc_rs;
use http::{Request, Response, Uri};
use rustls_platform_verifier::BuilderVerifierExt;

use crate::client_error::ClientError;

/// How calls reach the host: the local engine's router in process, or HTTP to a server.
#[derive(Clone)]
pub(crate) enum Transport {
    InProcess(ServiceTransport<Router>),
    Http(Box<HttpClient>),
}

impl Transport {
    pub(crate) fn in_process(router: Router) -> Self {
        Self::InProcess(ServiceTransport::new(router))
    }

    /// Plain HTTP for an `http` URL; TLS verified against the platform's trust store otherwise.
    pub(crate) fn remote(url: &Uri) -> Result<Self, ClientError> {
        if url.scheme_str() == Some("http") {
            return Ok(Self::Http(Box::new(HttpClient::plaintext())));
        }
        let config = ClientConfig::builder_with_provider(Arc::new(aws_lc_rs::default_provider()))
            .with_safe_default_protocol_versions()
            .and_then(BuilderVerifierExt::with_platform_verifier)
            .map_err(ClientError::Tls)?
            .with_no_client_auth();
        Ok(Self::Http(Box::new(HttpClient::with_tls(Arc::new(config)))))
    }
}

impl ClientTransport for Transport {
    type ResponseBody = Body;
    type Error = ConnectError;

    fn send(
        &self,
        request: Request<ClientBody>,
    ) -> BoxFuture<'static, Result<Response<Body>, ConnectError>> {
        match self {
            Self::InProcess(transport) => {
                let response = transport.send(request);
                Box::pin(async move {
                    let Ok(response) = response.await;
                    Ok(response)
                })
            }
            Self::Http(client) => {
                let response = client.send(request);
                Box::pin(async move { Ok(response.await?.map(Body::new)) })
            }
        }
    }
}
