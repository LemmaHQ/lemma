package io.github.mistvesper.lemma.client

/** What a tool message answers: the call [toolCallId], and whether the tool failed. */
data class ClientToolResult(val toolCallId: String, val isError: Boolean)
