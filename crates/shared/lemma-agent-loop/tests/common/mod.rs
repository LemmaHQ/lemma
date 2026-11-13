//! Fixtures the turn tests share: a migrated SQLite database holding one
//! session, and the turn input that continues it.

use std::error::Error;

use lemma_agent_loop::TurnInput;
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_model::ApiFormat;
use lemma_session::{LastModel, SessionService};
use sqlx::SqlitePool;
use uuid::Uuid;

pub(crate) async fn new_session(db: &SqlitePool) -> Result<(SessionService, Uuid), Box<dyn Error>> {
    let sessions = SessionService::new(db.clone());
    let session_id = sessions.create(None).await?.id;
    Ok((sessions, session_id))
}

pub(crate) fn input(session_id: Uuid) -> TurnInput {
    TurnInput {
        session_id,
        user_message_id: Uuid::new_v4(),
        user_message: Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: "hello".into(),
            })],
        },
        model: LastModel {
            provider_id: Uuid::new_v4(),
            model: "m".into(),
        },
        api_format: ApiFormat::OpenAiCompatible,
        tool_calling: true,
        system_prompt: None,
    }
}
