package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.client.MessageStatus

/**
 * Walks these tree messages upward from [leafId] to the root and returns the path oldest first;
 * empty for a null or unknown leaf.
 */
internal fun List<UiMessage>.activePath(leafId: String?): List<UiMessage> {
    val byId = associateBy { it.id }
    val path = mutableListOf<UiMessage>()
    val seen = HashSet<String>()
    var cursor = leafId
    while (cursor != null && seen.add(cursor)) {
        val message = byId[cursor] ?: break
        path += message
        cursor = message.parentId
    }
    return path.asReversed()
}

/** These tree messages without the messages below [id]; parents come before their children. */
internal fun List<UiMessage>.withoutDescendantsOf(id: String): List<UiMessage> {
    val dropped = hashSetOf(id)
    return filterNot { message ->
        (message.parentId in dropped).also { below -> if (below) dropped += message.id }
    }
}

/**
 * The question on this path whose turn still runs: [activeMessageId] when the path holds it,
 * otherwise, while the service names none, the last question when a reply after it still streams.
 */
internal fun List<UiMessage>.runningQuestionId(activeMessageId: String?): String? =
    if (activeMessageId != null) {
        activeMessageId.takeIf { id -> any { it.id == id } }
    } else {
        val userIndex = indexOfLast { it.role == MessageRole.User }
        if (userIndex >= 0 && drop(userIndex + 1).any { it.status == MessageStatus.Streaming }) {
            this[userIndex].id
        } else {
            null
        }
    }
