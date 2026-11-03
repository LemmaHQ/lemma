//! Fixtures the turn tests share: a migrated database holding one user's
//! session, and the turn input that continues it.

use std::error::Error;

use lemma_agent_loop::TurnInput;
use lemma_auth::AuthService;
use lemma_core::{ContentBlock, Message, TextContent};
use lemma_session::{LastModel, SessionService};
use sea_orm::DatabaseConnection;
use sea_orm_migration::{MigrationTrait, MigratorTrait};
use uuid::Uuid;

pub(crate) struct Migrator;

impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        let mut all: Vec<_> = [lemma_auth::migrations(), lemma_session::migrations()]
            .into_iter()
            .flatten()
            .collect();
        all.sort_by(|a, b| a.name().cmp(b.name()));
        all
    }
}

pub(crate) async fn new_session(
    db: &DatabaseConnection,
) -> Result<(SessionService, Uuid, Uuid), Box<dyn Error>> {
    let user_id = AuthService::new(db.clone(), "test-jwt-secret".to_owned())
        .sign_up("ada", "ada@example.com", "correct-horse")
        .await?
        .user
        .id;
    let sessions = SessionService::new(db.clone());
    let session_id = sessions.create(user_id).await?.id;
    Ok((sessions, user_id, session_id))
}

pub(crate) fn input(user_id: Uuid, session_id: Uuid) -> TurnInput {
    TurnInput {
        user_id,
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
    }
}
