use std::sync::Arc;

use dashmap::{DashMap, Entry};
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

/// Active turns indexed by user message ID and active session locks, holding
/// both cancellation and replayable event logs behind one lifecycle entry.
#[derive(Debug, Default)]
pub(crate) struct RunningTurns {
    turns: DashMap<Uuid, RunningTurn>,
    sessions: DashMap<Uuid, Uuid>,
}

/// Exclusive startup guard for one session; releases the session slot on drop
/// unless transferred to [`TurnWriter`] via [`Self::into_turn`].
pub(crate) struct SessionClaim {
    running: Arc<RunningTurns>,
    session_id: Uuid,
    user_message_id: Uuid,
    active: bool,
}

/// Appends events to a running turn's log and removes the turn and session
/// lock from [`RunningTurns`] when dropped.
pub(crate) struct TurnWriter {
    log: watch::Sender<Vec<TurnEvent>>,
    running: Arc<RunningTurns>,
    session_id: Uuid,
    user_message_id: Uuid,
}

impl RunningTurns {
    pub(crate) fn claim_session(
        self: &Arc<Self>,
        session_id: Uuid,
        user_message_id: Uuid,
    ) -> Option<SessionClaim> {
        match self.sessions.entry(session_id) {
            Entry::Occupied(_) => None,
            Entry::Vacant(slot) => {
                slot.insert(user_message_id);
                Some(SessionClaim {
                    running: Arc::clone(self),
                    session_id,
                    user_message_id,
                    active: true,
                })
            }
        }
    }

    pub(crate) fn active_turn(&self, session_id: Uuid) -> Option<Uuid> {
        self.sessions.get(&session_id).map(|entry| *entry)
    }

    pub(crate) fn resume(
        &self,
        user_message_id: Uuid,
        offset: usize,
    ) -> Option<impl Stream<Item = TurnEvent> + Send + 'static + use<>> {
        let entry = self.turns.get(&user_message_id)?;
        Some(follow(entry.log.clone(), offset))
    }

    pub(crate) fn abort(&self, user_message_id: Uuid) {
        if let Some(entry) = self.turns.get(&user_message_id) {
            entry.cancel.cancel();
        }
    }
}

impl SessionClaim {
    pub(crate) fn into_turn(
        mut self,
        cancel: CancelToken,
    ) -> (
        TurnWriter,
        impl Stream<Item = TurnEvent> + Send + 'static + use<>,
    ) {
        self.active = false;
        let (log, reader) = watch::channel(Vec::new());
        self.running.turns.insert(
            self.user_message_id,
            RunningTurn {
                cancel,
                log: reader.clone(),
            },
        );
        let writer = TurnWriter {
            log,
            running: Arc::clone(&self.running),
            session_id: self.session_id,
            user_message_id: self.user_message_id,
        };
        (writer, follow(reader, 0))
    }
}

impl Drop for SessionClaim {
    fn drop(&mut self) {
        if self.active {
            self.running.sessions.remove(&self.session_id);
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
        self.running.turns.remove(&self.user_message_id);
        self.running.sessions.remove(&self.session_id);
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
