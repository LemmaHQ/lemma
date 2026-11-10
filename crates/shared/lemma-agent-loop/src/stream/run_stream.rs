use chrono::Utc;
use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};

use crate::cancel_token::CancelToken;
use crate::turn_event::TurnEvent;

use super::accumulator::Accumulator;
use super::step_outcome::{StepEnd, StepOutcome};

async fn drain<O: Fn(TurnEvent)>(
    acc: &mut Accumulator,
    mut stream: BoxEventStream,
    observer: &O,
) -> Result<(), String> {
    use futures::StreamExt;

    while let Some(event) = stream.next().await {
        if let Some(delta) = acc.apply(event.map_err(|e: ModelError| e.message)?) {
            observer(delta);
        }
    }
    Ok(())
}

/// Runs one model stream to completion or cancellation, accumulating
/// content blocks and forwarding deltas to `observer`.
pub(crate) async fn run_stream<A: Adapter, O: Fn(TurnEvent)>(
    adapter: &A,
    req: ModelRequest,
    observer: &O,
    cancel: &CancelToken,
) -> StepOutcome {
    let mut acc = Accumulator {
        blocks: Vec::new(),
        open: None,
        usage: None,
        stop_reason: StopReason::Stop,
        pending_thinking: None,
        ended_at: None,
    };
    let streamed = async {
        let stream = adapter.stream(req).await.map_err(|e| e.message)?;
        drain(&mut acc, stream, observer).await
    };
    let end = tokio::select! {
        result = streamed => match result {
            Ok(()) => StepEnd::Completed,
            Err(message) => StepEnd::Failed(message),
        },
        () = cancel.cancelled() => StepEnd::Aborted,
    };
    let ended_at = acc.ended_at.unwrap_or_else(Utc::now);
    if !matches!(end, StepEnd::Completed) || acc.stop_reason != StopReason::ToolUse {
        acc.finish_thinking(ended_at);
    }
    acc.close_open(None);
    let stop_reason = match end {
        StepEnd::Aborted => StopReason::Aborted,
        StepEnd::Completed | StepEnd::Failed(_) => acc.stop_reason,
    };
    StepOutcome {
        blocks: acc.blocks,
        stop_reason,
        usage: acc.usage,
        end,
        ended_at,
    }
}
