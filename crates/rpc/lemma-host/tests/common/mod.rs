//! A local engine over a temporary data directory, called through
//! `InProcessTransport` with Connect JSON requests.

#![allow(dead_code)]

use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

use axum::Router;
use lemma_host::{InProcessTransport, LocalEngine};
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
        Self(env::temp_dir().join(format!("lemma-host-test-{}", Uuid::new_v4())))
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
    pub(crate) headers: Vec<(String, String)>,
    pub(crate) body: Value,
}

impl Reply {
    pub(crate) fn header_values(&self, name: &str) -> Vec<&str> {
        self.headers
            .iter()
            .filter(|(header, _)| header == name)
            .map(|(_, value)| value.as_str())
            .collect()
    }
}

pub(crate) struct Engine {
    local: Option<LocalEngine>,
    transport: InProcessTransport,
    dir: DataDir,
}

impl Engine {
    pub(crate) async fn open() -> Result<Self, Box<dyn Error>> {
        Self::open_in(DataDir::new()).await
    }

    pub(crate) async fn open_with_secrets_of(other: &Self) -> Result<Self, Box<dyn Error>> {
        let dir = DataDir::new();
        fs::create_dir_all(&dir.0)?;
        fs::copy(other.dir.0.join("secrets.json"), dir.0.join("secrets.json"))?;
        Self::open_in(dir).await
    }

    async fn open_in(dir: DataDir) -> Result<Self, Box<dyn Error>> {
        let local = LocalEngine::open(&dir.0).await?;
        let transport = InProcessTransport::new(local.router());
        Ok(Self {
            local: Some(local),
            transport,
            dir,
        })
    }

    pub(crate) async fn close(&mut self) -> Result<(), Box<dyn Error>> {
        if let Some(local) = self.local.take() {
            local.close().await?;
        }
        Ok(())
    }

    pub(crate) fn jwt_secret(&self) -> Result<String, Box<dyn Error>> {
        let secrets: Value =
            serde_json::from_str(&fs::read_to_string(self.dir.0.join("secrets.json"))?)?;
        secrets["jwt_secret"]
            .as_str()
            .map(str::to_owned)
            .ok_or_else(|| "no jwt_secret in secrets.json".into())
    }

    pub(crate) async fn reopen_with_secret_key(&mut self, key: &str) -> Result<(), Box<dyn Error>> {
        self.close().await?;
        let path = self.dir.0.join("secrets.json");
        let mut secrets: Value = serde_json::from_str(&fs::read_to_string(&path)?)?;
        secrets["secret_key"] = json!(key);
        fs::write(&path, serde_json::to_string(&secrets)?)?;
        let local = LocalEngine::open(&self.dir.0).await?;
        self.transport = InProcessTransport::new(local.router());
        self.local = Some(local);
        Ok(())
    }

    pub(crate) fn data_dir(&self) -> &Path {
        &self.dir.0
    }

    pub(crate) async fn stream_as(
        &self,
        token: &str,
        path: &str,
        body: &Value,
    ) -> Result<Frames, Box<dyn Error>> {
        let json = serde_json::to_vec(body)?;
        let mut envelope = vec![0];
        envelope.extend_from_slice(&u32::try_from(json.len())?.to_be_bytes());
        envelope.extend_from_slice(&json);
        let headers = [
            (
                "content-type".to_owned(),
                "application/connect+json".to_owned(),
            ),
            ("authorization".to_owned(), format!("Bearer {token}")),
        ];
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

    pub(crate) async fn call_with(
        &self,
        path: &str,
        headers: &[(&str, &str)],
        body: &Value,
    ) -> Result<Reply, Box<dyn Error>> {
        let mut all = vec![("content-type".to_owned(), "application/json".to_owned())];
        all.extend(
            headers
                .iter()
                .map(|(name, value)| ((*name).to_owned(), (*value).to_owned())),
        );
        let head = self
            .transport
            .request("POST", path, &all, serde_json::to_vec(body)?)
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
            headers: head.headers,
            body,
        })
    }

    pub(crate) async fn call(&self, path: &str, body: &Value) -> Result<Reply, Box<dyn Error>> {
        self.call_with(path, &[], body).await
    }

    pub(crate) async fn call_as(
        &self,
        token: &str,
        path: &str,
        body: &Value,
    ) -> Result<Reply, Box<dyn Error>> {
        let bearer = format!("Bearer {token}");
        self.call_with(path, &[("authorization", &bearer)], body)
            .await
    }

    pub(crate) async fn sign_up(&self, username: &str) -> Result<Value, Box<dyn Error>> {
        let reply = self
            .call(
                "/lemma.v1.AuthService/SignUp",
                &json!({
                    "username": username,
                    "email": format!("{username}@example.com"),
                    "password": "correct-horse",
                }),
            )
            .await?;
        if reply.status != 200 {
            return Err(format!("sign-up of {username}: {reply:?}").into());
        }
        Ok(reply.body)
    }

    pub(crate) async fn token(&self, username: &str) -> Result<String, Box<dyn Error>> {
        let body = self.sign_up(username).await?;
        body["tokens"]["accessToken"]
            .as_str()
            .map(str::to_owned)
            .ok_or_else(|| format!("no access token in {body}").into())
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
