//! An engine over a temporary data directory, called through
//! `InProcessTransport` with Connect JSON requests.

#![allow(dead_code)]

use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

use axum::Router;
use lemma_engine::{Engine, InProcessTransport};
use lemma_proto::lemma::v1::ErrorReason;
use serde_json::{Value, json};
use tokio::net::TcpListener;
use uuid::Uuid;

pub(crate) async fn serve(router: Router) -> Result<String, Box<dyn Error>> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    tokio::spawn(async move { axum::serve(listener, router).await });
    Ok(format!("http://{address}"))
}

pub(crate) struct DataDir(pub(crate) PathBuf);

impl DataDir {
    pub(crate) fn new() -> Self {
        Self(env::temp_dir().join(format!("lemma-engine-test-{}", Uuid::new_v4())))
    }
}

impl Drop for DataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[derive(Debug)]
pub(crate) struct Reply {
    pub(crate) status: u16,
    pub(crate) body: Value,
}

pub(crate) struct TestEngine {
    engine: Option<Engine>,
    transport: InProcessTransport,
    dir: DataDir,
}

impl TestEngine {
    pub(crate) async fn open() -> Result<Self, Box<dyn Error>> {
        let dir = DataDir::new();
        let engine = Engine::open(&dir.0).await?;
        let transport = InProcessTransport::new(engine.router());
        Ok(Self {
            engine: Some(engine),
            transport,
            dir,
        })
    }

    pub(crate) async fn close(&mut self) {
        if let Some(engine) = self.engine.take() {
            engine.close().await;
        }
    }

    pub(crate) async fn reopen_with_secret_key(&mut self, key: &str) -> Result<(), Box<dyn Error>> {
        self.close().await;
        let path = self.dir.0.join("secrets.json");
        let mut secrets: Value = serde_json::from_str(&fs::read_to_string(&path)?)?;
        secrets["secret_key"] = json!(key);
        fs::write(&path, serde_json::to_string(&secrets)?)?;
        let engine = Engine::open(&self.dir.0).await?;
        self.transport = InProcessTransport::new(engine.router());
        self.engine = Some(engine);
        Ok(())
    }

    pub(crate) fn data_dir(&self) -> &Path {
        &self.dir.0
    }

    pub(crate) async fn stream(&self, path: &str, body: &Value) -> Result<Frames, Box<dyn Error>> {
        let json = serde_json::to_vec(body)?;
        let mut envelope = vec![0];
        envelope.extend_from_slice(&u32::try_from(json.len())?.to_be_bytes());
        envelope.extend_from_slice(&json);
        let headers = [(
            "content-type".to_owned(),
            "application/connect+json".to_owned(),
        )];
        let head = self
            .transport
            .request("POST", path, &headers, envelope)
            .await?;
        Ok(Frames {
            status: head.status,
            body: head.body,
            buffer: Vec::new(),
        })
    }

    pub(crate) async fn next_frame(
        &self,
        frames: &mut Frames,
    ) -> Result<Option<Frame>, Box<dyn Error>> {
        loop {
            if let Some(header) = frames.buffer.get(..5) {
                let length = usize::try_from(u32::from_be_bytes([
                    header[1], header[2], header[3], header[4],
                ]))?;
                if frames.buffer.len() >= 5 + length {
                    let flags = header[0];
                    let payload: Vec<u8> = frames.buffer.drain(..5 + length).skip(5).collect();
                    let value = serde_json::from_slice(&payload)?;
                    return Ok(Some(if flags & 2 == 0 {
                        Frame::Message(value)
                    } else {
                        Frame::End(value)
                    }));
                }
            }
            match self.transport.read(frames.body).await? {
                Some(chunk) => frames.buffer.extend_from_slice(&chunk),
                None => return Ok(None),
            }
        }
    }

    pub(crate) async fn finish(
        &self,
        frames: &mut Frames,
    ) -> Result<(Vec<Value>, Value), Box<dyn Error>> {
        let mut messages = Vec::new();
        while let Some(frame) = self.next_frame(frames).await? {
            match frame {
                Frame::Message(message) => messages.push(message),
                Frame::End(end) => return Ok((messages, end)),
            }
        }
        Err(format!("stream ended without an end frame after {messages:?}").into())
    }

    pub(crate) async fn call(&self, path: &str, body: &Value) -> Result<Reply, Box<dyn Error>> {
        let headers = [("content-type".to_owned(), "application/json".to_owned())];
        let head = self
            .transport
            .request("POST", path, &headers, serde_json::to_vec(body)?)
            .await?;
        let mut bytes = Vec::new();
        while let Some(chunk) = self.transport.read(head.body).await? {
            bytes.extend_from_slice(&chunk);
        }
        let body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes)?
        };
        Ok(Reply {
            status: head.status,
            body,
        })
    }
}

pub(crate) fn assert_reason(reply: &Reply, reason: ErrorReason) {
    let expected = lemma_proto::app_error(reason);
    let body: Value = serde_json::from_slice(&expected.to_json()).unwrap_or(Value::Null);
    assert_eq!(
        (reply.status, &reply.body),
        (expected.http_status().as_u16(), &body),
        "{reason:?}"
    );
}

pub(crate) fn assert_internal(reply: &Reply, message_prefix: &str) {
    assert_eq!(reply.status, 500, "internal status of {reply:?}");
    assert_eq!(reply.body["code"], "internal", "internal code of {reply:?}");
    assert!(
        reply.body["message"]
            .as_str()
            .is_some_and(|message| message.starts_with(message_prefix)),
        "message of {reply:?}"
    );
}

pub(crate) struct Frames {
    pub(crate) status: u16,
    body: u32,
    buffer: Vec<u8>,
}

#[derive(Debug)]
pub(crate) enum Frame {
    Message(Value),
    End(Value),
}

pub(crate) fn assert_stream_reason(end: &Value, reason: ErrorReason) {
    let expected = lemma_proto::app_error(reason);
    let error: Value = serde_json::from_slice(&expected.to_json()).unwrap_or(Value::Null);
    assert_eq!(end, &json!({ "error": error }), "{reason:?}");
}
