package dev.lemmahq.lemma.ui.agent

/** Where a session's turn stands: running, or how it ended. */
internal enum class TurnState {
    Running,
    Done,
    Aborted,
    Failed,
}
