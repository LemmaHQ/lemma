package dev.lemmahq.lemma

import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.client.LemmaClient

/** The part of the app the stored connection and sign-in state allow. */
sealed interface AppState {

    /** The stored connection is opening. */
    data object Opening : AppState

    /** No connection is chosen. */
    data object Setup : AppState

    data class Connected(
        val connection: Connection,
        val client: LemmaClient,
        val signedIn: Boolean,
    ) : AppState
}
