package dev.lemmahq.lemma.client

/** Lifecycle of an assistant message: generating, finished, stopped by the user, or failed. */
enum class MessageStatus {
    Streaming,
    Done,
    Aborted,
    Error,
}
