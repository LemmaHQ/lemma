package dev.lemmahq.lemma.client

import kotlinx.serialization.Serializable

/** Lifecycle of an assistant message: generating, finished, stopped by the user, or failed. */
@Serializable
enum class MessageStatus {
    Streaming,
    Done,
    Aborted,
    Error,
}
