#![allow(clippy::unwrap_used, clippy::expect_used, missing_docs)]

use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent, ToolCall, Usage};

#[test]
fn message_roundtrip_preserves_structure() {
    let message = Message::Assistant {
        content: vec![
            ContentBlock::Text(TextContent {
                text: "Let me check.".to_string(),
            }),
            ContentBlock::ToolCall(ToolCall {
                id: "call_1".to_string(),
                name: "read_file".to_string(),
                arguments: serde_json::json!({ "path": "src/main.rs" }),
            }),
        ],
        stop_reason: StopReason::ToolUse,
        usage: Some(Usage {
            input: 120,
            output: 30,
            cache_read: None,
            cache_write: None,
        }),
    };

    let json = serde_json::to_string(&message).unwrap();
    let restored: Message = serde_json::from_str(&json).unwrap();
    assert_eq!(restored, message);
    assert_eq!(restored.tool_calls().len(), 1);
}

#[test]
fn stream_event_roundtrip_preserves_structure() {
    let events = vec![
        StreamEvent::Start,
        StreamEvent::ThinkingDelta {
            delta: "hmm".to_string(),
        },
        StreamEvent::ToolCallStart {
            id: "call_1".to_string(),
            name: "read_file".to_string(),
        },
        StreamEvent::Done {
            stop_reason: StopReason::Stop,
            usage: None,
        },
    ];

    let json = serde_json::to_string(&events).unwrap();
    let restored: Vec<StreamEvent> = serde_json::from_str(&json).unwrap();
    assert_eq!(restored, events);
}
