package dev.lemmahq.lemma

import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.i18n.UiText

/** The part of the app the engine state allows. */
sealed interface AppState {

    /** The engine is opening. */
    data object Opening : AppState

    /** The engine failed to open with [error]. */
    data class Failed(val error: UiText) : AppState

    /** The engine is open and serving [client]. */
    data class Ready(val client: LemmaClient) : AppState
}
