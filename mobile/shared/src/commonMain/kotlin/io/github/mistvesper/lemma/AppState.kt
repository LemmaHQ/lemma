package io.github.mistvesper.lemma

import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.i18n.UiText

/** The part of the app the engine state allows. */
sealed interface AppState {
    data object Opening : AppState

    data class Failed(val error: UiText) : AppState

    data class Ready(val client: LemmaClient) : AppState
}
