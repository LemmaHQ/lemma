use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use axum::Router;
use axum::body::{Body, BodyDataStream, Bytes};
use axum::http::Request;
use futures::StreamExt;
use tokio::sync::Mutex as AsyncMutex;

use crate::in_process_transport_error::InProcessTransportError;

type OpenBodies = HashMap<u32, Arc<AsyncMutex<BodyDataStream>>>;

/// Status line and headers of a response whose body is read by
/// [`InProcessTransport::read`] under `body`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResponseHead {
    /// Id of the open response body.
    pub body: u32,
    /// HTTP status code.
    pub status: u16,
    /// Header names and values, in response order.
    pub headers: Vec<(String, String)>,
}

/// Serves HTTP requests on a router inside the process: a request returns
/// its response head at once, and the caller pulls the body chunk by chunk,
/// so a slow reader holds back a streaming RPC instead of buffering it.
#[derive(Debug)]
pub struct InProcessTransport {
    router: Router,
    bodies: Mutex<OpenBodies>,
    next_body: AtomicU32,
}

impl InProcessTransport {
    /// Serves requests on `router`.
    #[must_use]
    pub fn new(router: Router) -> Self {
        Self {
            router,
            bodies: Mutex::new(HashMap::new()),
            next_body: AtomicU32::new(1),
        }
    }

    /// Sends one request through the router and opens its response body.
    ///
    /// # Errors
    ///
    /// [`InProcessTransportError::InvalidRequest`] when the method, path, or
    /// a header is not valid HTTP.
    pub async fn request(
        &self,
        method: &str,
        path: &str,
        headers: &[(String, String)],
        body: Vec<u8>,
    ) -> Result<ResponseHead, InProcessTransportError> {
        use tower::ServiceExt;

        let mut builder = Request::builder().method(method).uri(path);
        for (name, value) in headers {
            builder = builder.header(name, value);
        }
        let request = builder
            .body(Body::from(body))
            .map_err(|e| InProcessTransportError::InvalidRequest(e.to_string()))?;
        let Ok(response) = self.router.clone().oneshot(request).await;
        let (parts, body) = response.into_parts();
        let id = self.next_body.fetch_add(1, Ordering::Relaxed);
        self.bodies()
            .insert(id, Arc::new(AsyncMutex::new(body.into_data_stream())));
        Ok(ResponseHead {
            body: id,
            status: parts.status.as_u16(),
            headers: parts
                .headers
                .iter()
                .map(|(name, value)| {
                    (
                        name.as_str().to_owned(),
                        String::from_utf8_lossy(value.as_bytes()).into_owned(),
                    )
                })
                .collect(),
        })
    }

    /// Reads the next chunk of an open response body; `None` marks its end
    /// and closes it.
    ///
    /// # Errors
    ///
    /// [`InProcessTransportError::UnknownBody`] when `body` is not open;
    /// [`InProcessTransportError::Body`] when the body fails, which also
    /// closes it.
    pub async fn read(&self, body: u32) -> Result<Option<Bytes>, InProcessTransportError> {
        let stream = self
            .bodies()
            .get(&body)
            .cloned()
            .ok_or(InProcessTransportError::UnknownBody(body))?;
        let next = stream.lock().await.next().await;
        match next {
            Some(Ok(chunk)) => Ok(Some(chunk)),
            Some(Err(e)) => {
                self.bodies().remove(&body);
                Err(InProcessTransportError::Body(e.to_string()))
            }
            None => {
                self.bodies().remove(&body);
                Ok(None)
            }
        }
    }

    /// Closes an open response body before its end; an unknown id is
    /// ignored.
    pub fn cancel(&self, body: u32) {
        self.bodies().remove(&body);
    }

    fn bodies(&self) -> MutexGuard<'_, OpenBodies> {
        self.bodies.lock().unwrap_or_else(PoisonError::into_inner)
    }
}
