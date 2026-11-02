use std::sync::Arc;

use dashmap::DashMap;
use futures::{Stream, stream};
use lemma_proto::lemma::v1::AgentEvent;
use tokio::sync::watch;
use uuid::Uuid;

#[derive(Debug)]
struct LiveTurn {
    user_id: Uuid,
    log: watch::Receiver<Vec<AgentEvent>>,
}

/// The event logs of running turns, by user message id; any number of
/// streams read a log from any offset.
#[derive(Debug, Default)]
pub(crate) struct LiveTurns(DashMap<Uuid, LiveTurn>);

/// Appends a running turn's events. Dropping it ends the log and
/// unregisters the turn; open streams finish reading the log.
pub(crate) struct LogWriter {
    log: watch::Sender<Vec<AgentEvent>>,
    turns: Arc<LiveTurns>,
    user_message_id: Uuid,
}

impl LiveTurns {
    /// Registers the user's turn and returns its writer and a stream of its
    /// events from the start.
    pub(crate) fn start(
        self: &Arc<Self>,
        user_id: Uuid,
        user_message_id: Uuid,
    ) -> (LogWriter, impl Stream<Item = AgentEvent> + use<>) {
        let (log, reader) = watch::channel(Vec::new());
        self.0.insert(
            user_message_id,
            LiveTurn {
                user_id,
                log: reader.clone(),
            },
        );
        let writer = LogWriter {
            log,
            turns: Arc::clone(self),
            user_message_id,
        };
        (writer, follow(reader, 0))
    }

    /// Streams the user's running turn from `offset`; `None` when no such
    /// turn is running.
    pub(crate) fn follow(
        &self,
        user_id: Uuid,
        user_message_id: Uuid,
        offset: usize,
    ) -> Option<impl Stream<Item = AgentEvent> + use<>> {
        let turn = self.0.get(&user_message_id)?;
        (turn.user_id == user_id).then(|| follow(turn.log.clone(), offset))
    }
}

impl LogWriter {
    /// Appends one event.
    pub(crate) fn push(&self, event: AgentEvent) {
        self.log.send_modify(|events| events.push(event));
    }
}

impl Drop for LogWriter {
    fn drop(&mut self) {
        self.turns.0.remove(&self.user_message_id);
    }
}

fn follow(log: watch::Receiver<Vec<AgentEvent>>, offset: usize) -> impl Stream<Item = AgentEvent> {
    stream::unfold((log, offset), |(mut log, next)| async move {
        loop {
            let event = log.borrow_and_update().get(next).cloned();
            if let Some(event) = event {
                return Some((event, (log, next + 1)));
            }
            log.changed().await.ok()?;
        }
    })
}
