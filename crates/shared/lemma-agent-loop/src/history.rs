use std::collections::HashSet;

use lemma_core::{ContentBlock, Message};

pub(crate) fn for_model(messages: Vec<Message>, tool_calling: bool) -> Vec<Message> {
    let answered: HashSet<String> = if tool_calling {
        messages
            .iter()
            .filter_map(|message| match message {
                Message::ToolResult { tool_call_id, .. } => Some(tool_call_id.clone()),
                Message::User { .. } | Message::Assistant { .. } => None,
            })
            .collect()
    } else {
        HashSet::new()
    };
    messages
        .into_iter()
        .filter_map(|message| match message {
            Message::Assistant {
                content,
                stop_reason,
                usage,
            } => {
                let content: Vec<_> = content
                    .into_iter()
                    .filter(|block| match block {
                        ContentBlock::ToolCall(call) => tool_calling && answered.contains(&call.id),
                        ContentBlock::Text(_) | ContentBlock::Thinking(_) => true,
                    })
                    .collect();
                let keep = content.iter().any(|block| match block {
                    ContentBlock::Text(text) => !text.text.is_empty(),
                    ContentBlock::Thinking(_) => tool_calling,
                    ContentBlock::ToolCall(_) => true,
                });
                keep.then_some(Message::Assistant {
                    content,
                    stop_reason,
                    usage,
                })
            }
            tool @ Message::ToolResult { .. } => tool_calling.then_some(tool),
            user @ Message::User { .. } => Some(user),
        })
        .collect()
}
