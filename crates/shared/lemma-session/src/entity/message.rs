use lemma_core::Message as CoreMessage;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// The canonical message of a stored entry, held in a JSON column.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, FromJsonQueryResult)]
#[serde(transparent)]
pub struct MessageBody(pub CoreMessage);

/// Lifecycle status of a stored message.
#[derive(Clone, Copy, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(
    rs_type = "String",
    db_type = "String(StringLen::None)",
    rename_all = "snake_case"
)]
pub enum MessageStatus {
    /// Generation in progress; the row is a placeholder.
    Streaming,
    /// Generation completed normally.
    Done,
    /// Generation cancelled by the user.
    Aborted,
    /// Generation failed.
    Error,
}

/// A message in a session tree.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "messages")]
pub struct Model {
    /// Message id.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Owning session.
    pub session_id: Uuid,
    /// Parent message in the session tree; `None` for roots.
    pub parent_id: Option<Uuid>,
    /// Canonical message body.
    pub body: MessageBody,
    /// Lifecycle status of the entry.
    pub status: MessageStatus,
    /// Failure reason when status is `Error`; `None` otherwise.
    pub error: Option<String>,
    /// Provider the message was dispatched to, when known. A plain id: the
    /// provider may be deleted later.
    pub provider_id: Option<Uuid>,
    /// Model identifier that produced the entry, when known.
    pub model: Option<String>,
    /// Creation time.
    pub created_at: DateTimeUtc,
    /// Last update time.
    pub updated_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    /// Authoring role string: `user`, `assistant`, or `tool`.
    #[must_use]
    pub fn role(&self) -> &'static str {
        match self.body.0 {
            CoreMessage::User { .. } => "user",
            CoreMessage::Assistant { .. } => "assistant",
            CoreMessage::ToolResult { .. } => "tool",
        }
    }
}
