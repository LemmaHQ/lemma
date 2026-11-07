package dev.lemmahq.lemma.client

import kotlinx.serialization.Serializable

/** What a tool message answers: the call [toolCallId], and whether the tool failed. */
@Serializable data class ClientToolResult(val toolCallId: String, val isError: Boolean)
