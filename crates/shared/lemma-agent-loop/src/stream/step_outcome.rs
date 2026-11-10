use chrono::{DateTime, Utc};
use lemma_core::{ContentBlock, StopReason, TextContent, Usage};

/// How one model stream ended.
pub(crate) enum StepEnd {
    Completed,
    Failed(String),
    Aborted,
}

/// Settled result of one model stream: accumulated blocks and terminal
/// state.
pub(crate) struct StepOutcome {
    pub(crate) blocks: Vec<ContentBlock>,
    pub(crate) stop_reason: StopReason,
    pub(crate) usage: Option<Usage>,
    pub(crate) end: StepEnd,
    pub(crate) ended_at: DateTime<Utc>,
}

impl StepOutcome {
    pub(crate) fn full_text(&self) -> String {
        self.blocks
            .iter()
            .filter_map(ContentBlock::plain_text)
            .collect()
    }

    pub(crate) fn content(&self) -> Vec<ContentBlock> {
        if self
            .blocks
            .iter()
            .all(|b| matches!(b, ContentBlock::Text(_)))
        {
            vec![ContentBlock::Text(TextContent {
                text: self.full_text(),
            })]
        } else {
            self.blocks.clone()
        }
    }

    pub(crate) fn finish_thinking(&mut self, at: DateTime<Utc>) {
        for block in &mut self.blocks {
            if let ContentBlock::Thinking(thinking) = block
                && thinking.started_at.is_some()
                && thinking.finished_at.is_none()
            {
                thinking.finished_at = Some(at);
            }
        }
    }
}
