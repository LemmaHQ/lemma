use chrono::{DateTime, Utc};
use lemma_proto::lemma::v1::{AgentEvent, ToolCallStarted, agent_delta, agent_event};

use crate::message_item::{MessageError, MessageStatus, ToolCallItem};
use crate::open_session::OpenSession;

impl OpenSession {
    /// Folds one stream event into the current reply.
    pub fn apply(&mut self, event: &AgentEvent) {
        let Some(kind) = event.kind.as_ref() else {
            return;
        };
        let Some(reply_index) = self.current_reply else {
            return;
        };
        let at = occurred_at(event);
        match kind {
            agent_event::Kind::Started(started) => {
                if let Some(index) = self.optimistic_user.take() {
                    self.items[index].id.clone_from(&started.message_id);
                }
            }
            agent_event::Kind::TurnStarted(started) => {
                self.turn_started(reply_index, &started.message_id);
            }
            agent_event::Kind::Delta(delta) => {
                let Some(part) = delta.part.as_ref() else {
                    return;
                };
                let reply = &mut self.items[reply_index];
                match part {
                    agent_delta::Part::Text(text) => {
                        reply.content.push_str(&text.content);
                        Self::close_thinking(reply, at);
                    }
                    agent_delta::Part::Thinking(thinking) => {
                        reply.thinking.push_str(&thinking.content);
                        if reply.thinking_started_at.is_none() {
                            reply.thinking_started_at = at;
                        }
                    }
                }
            }
            agent_event::Kind::ToolCallStarted(started) => {
                self.tool_started(reply_index, started, at);
            }
            agent_event::Kind::ToolCallFinished(finished) => {
                let reply = &mut self.items[reply_index];
                let Some(call) = reply
                    .tool_calls
                    .iter_mut()
                    .find(|call| call.id == finished.call_id)
                else {
                    return;
                };
                call.output.clone_from(&finished.content);
                call.is_error = finished.is_error;
                call.running = false;
                call.finished_at = at;
            }
            agent_event::Kind::Done(_) => {
                self.finish_reply(reply_index, MessageStatus::Done, None, at);
            }
            agent_event::Kind::Aborted(_) => {
                self.finish_reply(reply_index, MessageStatus::Aborted, None, at);
            }
            agent_event::Kind::Error(error) => {
                self.finish_reply(
                    reply_index,
                    MessageStatus::Error,
                    Some(MessageError::Server(error.message.clone())),
                    at,
                );
            }
        }
    }

    fn turn_started(&mut self, reply_index: usize, message_id: &str) {
        let reply = &self.items[reply_index];
        let empty =
            reply.content.is_empty() && reply.thinking.is_empty() && reply.tool_calls.is_empty();
        let provider_id = reply.provider_id.clone();
        let model = reply.model.clone();
        if empty {
            self.items[reply_index].id = message_id.to_owned();
            return;
        }
        if self.items[reply_index].status == MessageStatus::Streaming {
            self.items[reply_index].status = MessageStatus::Done;
        }
        let next_index = self.items.len();
        self.items.push(Self::streaming_reply(
            message_id.to_owned(),
            &provider_id,
            &model,
        ));
        self.current_reply = Some(next_index);
    }

    fn tool_started(
        &mut self,
        reply_index: usize,
        started: &ToolCallStarted,
        at: Option<DateTime<Utc>>,
    ) {
        let reply = &mut self.items[reply_index];
        Self::close_thinking(reply, at);
        reply.tool_calls.push(ToolCallItem {
            id: started.call_id.clone(),
            name: started.name.clone(),
            arguments: started.arguments.clone(),
            output: String::new(),
            is_error: false,
            running: true,
            started_at: at,
            finished_at: None,
        });
    }

    fn finish_reply(
        &mut self,
        reply_index: usize,
        status: MessageStatus,
        error: Option<MessageError>,
        at: Option<DateTime<Utc>>,
    ) {
        let reply = &mut self.items[reply_index];
        reply.status = status;
        if error.is_some() {
            reply.error = error;
        }
        Self::close_thinking(reply, at);
        self.current_reply = None;
        self.optimistic_user = None;
    }
}

fn occurred_at(event: &AgentEvent) -> Option<DateTime<Utc>> {
    DateTime::<Utc>::try_from(event.occurred_at.as_option()?.clone()).ok()
}
