package dev.lemmahq.lemma.client

/** Where the app sends its requests: the in-process engine or a server. */
sealed interface Connection {

    data object Local : Connection

    data class Remote(val serverUrl: String) : Connection
}
