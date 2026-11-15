use std::sync::Arc;

use uuid::Uuid;

use crate::running_turns::RunningTurns;

/// Read-only handle to query which turn is currently running on a session.
#[derive(Debug, Clone)]
pub struct ActiveTurns {
    running: Arc<RunningTurns>,
}

impl ActiveTurns {
    pub(crate) fn new(running: Arc<RunningTurns>) -> Self {
        Self { running }
    }

    /// User message ID of the turn currently running on `session_id`, if any.
    #[must_use]
    pub fn active_turn(&self, session_id: Uuid) -> Option<Uuid> {
        self.running.active_turn(session_id)
    }
}
