package dev.lemmahq.lemma.ui.agent

/** The turn of session [sessionId] reached [state]. */
internal data class SessionTurn(val sessionId: String, val state: TurnState)
