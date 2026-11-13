package dev.lemmahq.lemma

import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.i18n.UiText

/** The part of the app the local engine state allows. */
sealed interface AppState {

    /** The local engine is opening. */
    data object Opening : AppState

    /** The local engine failed to open with [error]. */
    data class Failed(val error: UiText) : AppState

    /** The local engine is open and serving [client]. */
    data class Ready(val client: LemmaClient) : AppState
}
