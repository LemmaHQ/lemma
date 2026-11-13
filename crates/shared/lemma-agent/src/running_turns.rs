use std::sync::Arc;

use dashmap::DashMap;
use futures::{Stream, stream};
use lemma_agent_loop::TurnEvent;
use lemma_tool::CancelToken;
use tokio::sync::watch;
use uuid::Uuid;

#[derive(Debug)]
struct RunningTurn {
    cancel: CancelToken,
    log: watch::Receiver<Vec<TurnEvent>>,
}

/// Active turns indexed by user message ID, holding both cancellation and
/// replayable event logs behind one lifecycle entry.
#[derive(Debug, Default)]
pub(crate) struct RunningTurns(DashMap<Uuid, RunningTurn>);

/// Appends events to a running turn's log and removes the turn from
/// [`RunningTurns`] when dropped.
pub(crate) struct TurnWriter {
    log: watch::Sender<Vec<TurnEvent>>,
    running: Arc<RunningTurns>,
    user_message_id: Uuid,
}

impl RunningTurns {
    pub(crate) fn start(
        self: &Arc<Self>,
        user_message_id: Uuid,
        cancel: CancelToken,
    ) -> (
        TurnWriter,
        impl Stream<Item = TurnEvent> + Send + 'static + use<>,
    ) {
        let (log, reader) = watch::channel(Vec::new());
        self.0.insert(
            user_message_id,
            RunningTurn {
                cancel,
                log: reader.clone(),
            },
        );
        let writer = TurnWriter {
            log,
            running: Arc::clone(self),
            user_message_id,
        };
        (writer, follow(reader, 0))
    }

    pub(crate) fn resume(
        &self,
        user_message_id: Uuid,
        offset: usize,
    ) -> Option<impl Stream<Item = TurnEvent> + Send + 'static + use<>> {
        let entry = self.0.get(&user_message_id)?;
        Some(follow(entry.log.clone(), offset))
    }

    pub(crate) fn abort(&self, user_message_id: Uuid) {
        if let Some(entry) = self.0.get(&user_message_id) {
            entry.cancel.cancel();
        }
    }
}

impl TurnWriter {
    pub(crate) fn push(&self, event: TurnEvent) {
        self.log.send_modify(|events| events.push(event));
    }
}

impl Drop for TurnWriter {
    fn drop(&mut self) {
        self.running.0.remove(&self.user_message_id);
    }
}

fn follow(
    log: watch::Receiver<Vec<TurnEvent>>,
    offset: usize,
) -> impl Stream<Item = TurnEvent> + Send + 'static {
    stream::unfold((log, offset, false), |(mut log, next, closed)| async move {
        let mut closed = closed;
        loop {
            let event = log.borrow_and_update().get(next).cloned();
            if let Some(event) = event {
                return Some((event, (log, next + 1, closed)));
            }
            if closed {
                return None;
            }
            if log.changed().await.is_err() {
                closed = true;
            }
        }
    })
}
