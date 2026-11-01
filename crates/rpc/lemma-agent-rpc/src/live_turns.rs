use std::sync::Arc;

use dashmap::DashMap;
use futures::{Stream, stream};
use lemma_proto::lemma::v1::AgentEvent;
use tokio::sync::watch;
use uuid::Uuid;

#[derive(Debug, Default)]
struct EventLog {
    events: Vec<AgentEvent>,
    ended: bool,
}

#[derive(Debug)]
struct LiveTurn {
    user_id: Uuid,
    log: watch::Receiver<EventLog>,
}

/// The event logs of running turns, by user message id; any number of
/// streams read a log from any offset.
#[derive(Debug, Default)]
pub(crate) struct LiveTurns(DashMap<Uuid, LiveTurn>);

/// Appends a running turn's events. Dropping it ends the log and
/// unregisters the turn; open streams finish reading the log.
pub(crate) struct LogWriter {
    log: watch::Sender<EventLog>,
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
        let (log, reader) = watch::channel(EventLog::default());
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
        self.log.send_modify(|log| log.events.push(event));
    }
}

impl Drop for LogWriter {
    fn drop(&mut self) {
        self.log.send_modify(|log| log.ended = true);
        self.turns.0.remove(&self.user_message_id);
    }
}

enum Read {
    Event(AgentEvent),
    Ended,
    Pending,
}

fn follow(log: watch::Receiver<EventLog>, offset: usize) -> impl Stream<Item = AgentEvent> {
    stream::unfold((log, offset), |(mut log, next)| async move {
        loop {
            let read = {
                let current = log.borrow_and_update();
                match current.events.get(next) {
                    Some(event) => Read::Event(event.clone()),
                    None if current.ended => Read::Ended,
                    None => Read::Pending,
                }
            };
            match read {
                Read::Event(event) => return Some((event, (log, next + 1))),
                Read::Ended => return None,
                Read::Pending => log.changed().await.ok()?,
            }
        }
    })
}
