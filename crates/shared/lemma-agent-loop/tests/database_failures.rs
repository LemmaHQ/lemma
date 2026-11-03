//! Every turn persistence failure is returned without advancing later state.

mod common;

use std::env;
use std::error::Error;
use std::sync::atomic::{AtomicUsize, Ordering};

use futures::stream;
use lemma_agent_loop::{AgentLoop, CancelToken, LoopError, ToolRuntime, TurnEvent};
use lemma_core::{StopReason, StreamEvent, ToolCall};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_session::MessageStatus;
use lemma_test_db::on_each_database;
use lemma_tool::{LocalExecEnv, ToolRegistry};
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend};
use serde_json::json;
use tokio::runtime::Handle;
use tokio::task;

use crate::common::{Migrator, input, new_session};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Failure {
    UserInsert,
    UserLeaf,
    LastModel,
    AssistantInsert,
    AssistantSettle,
    ToolSettle,
    ToolInsert,
    ToolLeaf,
    DroppedMessages,
}

struct Trigger {
    table: &'static str,
    event: &'static str,
    sqlite: &'static str,
    postgres: &'static str,
}

impl Trigger {
    const fn on(
        table: &'static str,
        event: &'static str,
        sqlite: &'static str,
        postgres: &'static str,
    ) -> Self {
        Self {
            table,
            event,
            sqlite,
            postgres,
        }
    }
}

impl Failure {
    const ALL: [Self; 9] = [
        Self::UserInsert,
        Self::UserLeaf,
        Self::LastModel,
        Self::AssistantInsert,
        Self::AssistantSettle,
        Self::ToolSettle,
        Self::ToolInsert,
        Self::ToolLeaf,
        Self::DroppedMessages,
    ];

    fn trigger(self) -> Option<Trigger> {
        let user = "json_extract(NEW.body, '$.role') = 'user'";
        let tool = "json_extract(NEW.body, '$.role') = 'tool_result'";
        let user_pg = "NEW.body->>'role' = 'user'";
        let tool_pg = "NEW.body->>'role' = 'tool_result'";
        let user_leaf = "EXISTS (SELECT 1 FROM messages WHERE id = NEW.leaf_id AND json_extract(body, '$.role') = 'user')";
        let tool_leaf = "EXISTS (SELECT 1 FROM messages WHERE id = NEW.leaf_id AND json_extract(body, '$.role') = 'tool_result')";
        let user_leaf_pg =
            "EXISTS (SELECT 1 FROM messages WHERE id = NEW.leaf_id AND body->>'role' = 'user')";
        let tool_leaf_pg = "EXISTS (SELECT 1 FROM messages WHERE id = NEW.leaf_id AND body->>'role' = 'tool_result')";
        let settled = "OLD.status = 'streaming' AND NEW.status = 'done'";
        let tool_settled = "EXISTS (SELECT 1 FROM json_each(NEW.body, '$.content') WHERE json_extract(value, '$.type') = 'tool_call' AND json_extract(value, '$.finished_at') IS NOT NULL)";
        let tool_settled_pg = "EXISTS (SELECT 1 FROM json_array_elements(NEW.body->'content') AS block WHERE block.value->>'type' = 'tool_call' AND block.value->>'finished_at' IS NOT NULL)";
        match self {
            Self::UserInsert => Some(Trigger::on("messages", "INSERT", user, user_pg)),
            Self::UserLeaf => Some(Trigger::on(
                "sessions",
                "UPDATE OF leaf_id",
                user_leaf,
                user_leaf_pg,
            )),
            Self::LastModel => Some(Trigger::on(
                "sessions",
                "UPDATE OF last_model",
                "TRUE",
                "TRUE",
            )),
            Self::AssistantInsert => Some(Trigger::on(
                "messages",
                "INSERT",
                "NEW.status = 'streaming'",
                "NEW.status = 'streaming'",
            )),
            Self::AssistantSettle => Some(Trigger::on("messages", "UPDATE", settled, settled)),
            Self::ToolSettle => Some(Trigger::on(
                "messages",
                "UPDATE",
                tool_settled,
                tool_settled_pg,
            )),
            Self::ToolInsert => Some(Trigger::on("messages", "INSERT", tool, tool_pg)),
            Self::ToolLeaf => Some(Trigger::on(
                "sessions",
                "UPDATE OF leaf_id",
                tool_leaf,
                tool_leaf_pg,
            )),
            Self::DroppedMessages => None,
        }
    }

    fn uses_tools(self) -> bool {
        matches!(self, Self::ToolSettle | Self::ToolInsert | Self::ToolLeaf)
    }
}

struct Scripted {
    tools: bool,
    step: AtomicUsize,
}

impl Adapter for Scripted {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let first = self.step.fetch_add(1, Ordering::SeqCst) == 0;
        let events = if self.tools && first {
            vec![
                Ok(StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id: "call-1".into(),
                        name: "missing_tool".into(),
                        arguments: json!({}),
                        started_at: None,
                        finished_at: None,
                    },
                }),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: None,
                }),
            ]
        } else {
            vec![
                Ok(StreamEvent::TextDelta {
                    delta: "done".into(),
                }),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::Stop,
                    usage: None,
                }),
            ]
        };
        Ok(Box::pin(stream::iter(events)))
    }
}

async fn install(db: &DatabaseConnection, failure: Failure) -> Result<(), Box<dyn Error>> {
    let Some(Trigger {
        table,
        event,
        sqlite,
        postgres,
    }) = failure.trigger()
    else {
        return Ok(());
    };
    if db.get_database_backend() == DbBackend::Postgres {
        db.execute_unprepared(&format!(
            "CREATE FUNCTION refuse_turn_write() RETURNS trigger LANGUAGE plpgsql AS $$ \
             BEGIN IF {postgres} THEN RAISE EXCEPTION 'turn write refused'; END IF; \
             RETURN NEW; END $$"
        ))
        .await?;
        db.execute_unprepared(&format!(
            "CREATE TRIGGER refuse_turn_write BEFORE {event} ON {table} \
             FOR EACH ROW EXECUTE FUNCTION refuse_turn_write()"
        ))
        .await?;
    } else {
        db.execute_unprepared(&format!(
            "CREATE TRIGGER refuse_turn_write BEFORE {event} ON {table} WHEN {sqlite} \
             BEGIN SELECT RAISE(ABORT, 'turn write refused'); END"
        ))
        .await?;
    }
    Ok(())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn persistence_failures_end_the_turn_at_the_failed_statement() -> Result<(), Box<dyn Error>> {
    for failure in Failure::ALL {
        on_each_database::<Migrator, _, _>(|db| async move {
            let (sessions, user_id, session_id) = new_session(&db).await?;
            install(&db, failure).await?;
            let adapter = Scripted {
                tools: failure.uses_tools(),
                step: AtomicUsize::new(0),
            };
            let runtime = ToolRuntime::new(ToolRegistry::new(), LocalExecEnv::new(env::temp_dir()));
            let agent_loop = AgentLoop::new(sessions.clone(), adapter, Some(runtime));
            let turn_input = input(user_id, session_id);
            let user_message_id = turn_input.user_message_id;
            let drop_db = db.clone();
            let observer = |event| {
                if failure == Failure::DroppedMessages
                    && matches!(event, TurnEvent::UserAppended { .. })
                {
                    let dropped = task::block_in_place(|| {
                        Handle::current()
                            .block_on(drop_db.execute_unprepared("DROP TABLE messages"))
                    });
                    assert!(dropped.is_ok(), "drop messages: {dropped:?}");
                }
            };
            let turn = agent_loop
                .run_turn(turn_input, &observer, &CancelToken::new())
                .await;

            let cause = match turn {
                Err(LoopError::Store(cause)) => cause,
                other => return Err(format!("{failure:?}: {other:?}").into()),
            };
            let expected = if failure == Failure::DroppedMessages {
                "messages"
            } else {
                "turn write refused"
            };
            assert!(cause.contains(expected), "{failure:?}: {cause}");
            let session = sessions
                .find(user_id, session_id)
                .await?
                .ok_or("session disappeared")?;
            if failure == Failure::DroppedMessages {
                assert_eq!(session.leaf_id, Some(user_message_id), "{failure:?}");
                assert!(session.last_model.is_some(), "{failure:?}");
                return Ok(());
            }
            let messages = sessions.all_messages(session_id).await?;
            let roles: Vec<_> = messages.iter().map(|message| message.role()).collect();
            let leaf = messages
                .iter()
                .find(|message| Some(message.id) == session.leaf_id);
            match failure {
                Failure::UserInsert => {
                    assert!(messages.is_empty(), "{failure:?}: {messages:?}");
                    assert_eq!(session.leaf_id, None);
                }
                Failure::UserLeaf => {
                    assert_eq!(roles, ["user"], "{failure:?}");
                    assert_eq!(session.leaf_id, None);
                }
                Failure::LastModel | Failure::AssistantInsert => {
                    assert_eq!(roles, ["user"], "{failure:?}");
                    assert_eq!(leaf.map(|message| message.role()), Some("user"));
                }
                Failure::AssistantSettle => {
                    assert_eq!(roles, ["user", "assistant"], "{failure:?}");
                    assert_eq!(messages[1].status, MessageStatus::Streaming);
                    assert_eq!(leaf.map(|message| message.role()), Some("assistant"));
                }
                Failure::ToolSettle => {
                    assert_eq!(roles, ["user", "assistant"], "{failure:?}");
                    assert_eq!(messages[1].status, MessageStatus::Done);
                    assert!(
                        messages[1]
                            .body
                            .0
                            .tool_calls()
                            .all(|call| call.finished_at.is_none())
                    );
                }
                Failure::ToolInsert | Failure::ToolLeaf => {
                    let expected = if failure == Failure::ToolInsert { 2 } else { 3 };
                    assert_eq!(messages.len(), expected, "{failure:?}: {roles:?}");
                    assert!(
                        messages[1]
                            .body
                            .0
                            .tool_calls()
                            .all(|call| call.finished_at.is_some())
                    );
                    assert_eq!(leaf.map(|message| message.role()), Some("assistant"));
                }
                Failure::DroppedMessages => unreachable!(),
            }
            Ok(())
        })
        .await?;
    }
    Ok(())
}
