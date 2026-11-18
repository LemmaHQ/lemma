package io.github.mistvesper.lemma.client

/** A session's complete message tree, ordered oldest first, with its active leaf and turn. */
data class ClientMessageTree(
    val messages: List<ClientMessage>,
    val leafId: String? = null,
    val activeMessageId: String? = null,
)

/** Walks [tree] upward from its leaf to the root and returns the active path oldest first. */
fun activePath(tree: ClientMessageTree): List<ClientMessage> {
    val byId = tree.messages.associateBy { it.id }
    val path = mutableListOf<ClientMessage>()
    val seen = HashSet<String>()
    var cursor = tree.leafId
    while (cursor != null && seen.add(cursor)) {
        val message = byId[cursor] ?: break
        path += message
        cursor = message.parentId
    }
    return path.asReversed()
}
