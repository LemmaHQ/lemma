use buffa_types::google::protobuf::Timestamp;
use lemma_agent::TurnEvent;
use lemma_proto::lemma::v1::{
    AgentDelta, AgentError, AgentEvent, AgentStarted, AgentTurnStarted, TextDelta, ThinkingDelta,
    ToolCallFinished, ToolCallStarted, agent_delta, agent_event,
};
use uuid::Uuid;

pub(crate) fn turn_event(ev: TurnEvent) -> AgentEvent {
    let (at, kind) = match ev {
        TurnEvent::UserAppended { id, parent_id, at } => (at, started_kind(id, parent_id)),
        TurnEvent::AssistantStarted { id, parent_id, at } => (at, turn_started_kind(id, parent_id)),
        TurnEvent::Delta { delta, at } => (at, text_delta_kind(delta)),
        TurnEvent::ThinkingDelta { delta, at } => (at, thinking_delta_kind(delta)),
        TurnEvent::ToolStarted {
            id,
            name,
            arguments,
            at,
        } => (at, tool_call_started_kind(id, name, arguments)),
        TurnEvent::ToolFinished {
            id,
            content,
            is_error,
            at,
        } => (at, tool_call_finished_kind(id, content, is_error)),
        TurnEvent::TurnAborted { at } => (at, agent_event::Kind::Aborted(Box::default())),
        TurnEvent::TurnFailed { message, at } => (
            at,
            agent_event::Kind::Error(Box::new(AgentError {
                message,
                ..Default::default()
            })),
        ),
        TurnEvent::AssistantDone { at, .. } => (at, agent_event::Kind::Done(Box::default())),
    };
    AgentEvent {
        kind: Some(kind),
        occurred_at: Timestamp::from(at).into(),
        ..Default::default()
    }
}

fn started_kind(id: Uuid, parent_id: Option<Uuid>) -> agent_event::Kind {
    agent_event::Kind::Started(Box::new(AgentStarted {
        message_id: id.to_string(),
        parent_id: parent_id.map(|p| p.to_string()),
        ..Default::default()
    }))
}

fn turn_started_kind(id: Uuid, parent_id: Uuid) -> agent_event::Kind {
    agent_event::Kind::TurnStarted(Box::new(AgentTurnStarted {
        message_id: id.to_string(),
        parent_id: parent_id.to_string(),
        ..Default::default()
    }))
}

fn text_delta_kind(content: String) -> agent_event::Kind {
    agent_event::Kind::Delta(Box::new(AgentDelta {
        part: Some(agent_delta::Part::Text(Box::new(TextDelta {
            content,
            ..Default::default()
        }))),
        ..Default::default()
    }))
}

fn thinking_delta_kind(content: String) -> agent_event::Kind {
    agent_event::Kind::Delta(Box::new(AgentDelta {
        part: Some(agent_delta::Part::Thinking(Box::new(ThinkingDelta {
            content,
            ..Default::default()
        }))),
        ..Default::default()
    }))
}

fn tool_call_started_kind(call_id: String, name: String, arguments: String) -> agent_event::Kind {
    agent_event::Kind::ToolCallStarted(Box::new(ToolCallStarted {
        call_id,
        name,
        arguments,
        ..Default::default()
    }))
}

fn tool_call_finished_kind(call_id: String, content: String, is_error: bool) -> agent_event::Kind {
    agent_event::Kind::ToolCallFinished(Box::new(ToolCallFinished {
        call_id,
        content,
        is_error,
        ..Default::default()
    }))
}
