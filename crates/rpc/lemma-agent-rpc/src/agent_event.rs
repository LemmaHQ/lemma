use buffa_types::google::protobuf::Timestamp;
use chrono::{DateTime, Utc};
use lemma_agent::TurnEvent;
use lemma_proto::lemma::v1::{
    AgentAborted, AgentDelta, AgentDone, AgentError, AgentEvent, AgentStarted, AgentTurnStarted,
    TextDelta, ThinkingDelta, ToolCallFinished, ToolCallStarted, agent_delta, agent_event,
};
use uuid::Uuid;

pub(crate) fn turn_event(ev: TurnEvent) -> AgentEvent {
    let at = match &ev {
        TurnEvent::Delta { at, .. }
        | TurnEvent::ThinkingDelta { at, .. }
        | TurnEvent::ToolStarted { at, .. }
        | TurnEvent::ToolFinished { at, .. }
        | TurnEvent::TurnAborted { at }
        | TurnEvent::TurnFailed { at, .. }
        | TurnEvent::AssistantDone { at, .. } => *at,
        TurnEvent::UserAppended { .. } | TurnEvent::AssistantStarted { .. } => Utc::now(),
    };
    let mut event = match ev {
        TurnEvent::UserAppended { id } => started_event(id),
        TurnEvent::AssistantStarted { id } => turn_started_event(id),
        TurnEvent::Delta { delta, .. } => text_delta_event(delta),
        TurnEvent::ThinkingDelta { delta, .. } => thinking_delta_event(delta),
        TurnEvent::ToolStarted {
            id,
            name,
            arguments,
            ..
        } => tool_call_started_event(id, name, arguments),
        TurnEvent::ToolFinished {
            id,
            content,
            is_error,
            ..
        } => tool_call_finished_event(id, content, is_error),
        TurnEvent::TurnAborted { at } => aborted_event(at),
        TurnEvent::TurnFailed { message, at } => error_event(&message, at),
        TurnEvent::AssistantDone { .. } => done_event(),
    };
    event.occurred_at = Timestamp::from(at).into();
    event
}

pub(crate) fn error_event(message: &str, at: DateTime<Utc>) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Error(Box::new(AgentError {
            message: message.to_string(),
            ..Default::default()
        }))),
        occurred_at: Timestamp::from(at).into(),
        ..Default::default()
    }
}

fn aborted_event(at: DateTime<Utc>) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Aborted(Box::new(AgentAborted {
            ..Default::default()
        }))),
        occurred_at: Timestamp::from(at).into(),
        ..Default::default()
    }
}

fn started_event(id: Uuid) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Started(Box::new(AgentStarted {
            message_id: id.to_string(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn text_delta_event(text: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Text(Box::new(TextDelta {
                content: text,
                ..Default::default()
            }))),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn thinking_delta_event(thinking: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Delta(Box::new(AgentDelta {
            part: Some(agent_delta::Part::Thinking(Box::new(ThinkingDelta {
                content: thinking,
                ..Default::default()
            }))),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn done_event() -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::Done(Box::new(AgentDone {
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn turn_started_event(id: Uuid) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::TurnStarted(Box::new(AgentTurnStarted {
            message_id: id.to_string(),
            ..Default::default()
        }))),
        ..Default::default()
    }
}

fn tool_call_started_event(call_id: String, name: String, arguments: String) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::ToolCallStarted(Box::new(
            ToolCallStarted {
                call_id,
                name,
                arguments,
                ..Default::default()
            },
        ))),
        ..Default::default()
    }
}

fn tool_call_finished_event(call_id: String, content: String, is_error: bool) -> AgentEvent {
    AgentEvent {
        kind: Some(agent_event::Kind::ToolCallFinished(Box::new(
            ToolCallFinished {
                call_id,
                content,
                is_error,
                ..Default::default()
            },
        ))),
        ..Default::default()
    }
}
