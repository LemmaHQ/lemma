package io.github.mistvesper.lemma

import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.i18n.UiText

/** The part of the app the engine state allows. */
sealed interface AppState {

    /** The engine is opening. */
    data object Opening : AppState

    /** The engine failed to open with [error]. */
    data class Failed(val error: UiText) : AppState

    /** The engine is open and serving [client]. */
    data class Ready(val client: LemmaClient) : AppState
}
