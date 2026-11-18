package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.i18n.UiText

/** The [rows] of a session's message tree and its [pathCount], one path per leaf row. */
internal data class SessionTree(val rows: List<TreeRow>, val pathCount: Int)

/**
 * The tree of [messages] with the path to [leafId] marked, in rows from the roots down. A reply row
 * collapses an assistant message with the tool messages and steps that follow it alone; the
 * children on the marked path come first, and the rows below a fork go one level deeper. A message
 * whose parent is missing is a root.
 */
internal fun buildSessionTree(messages: List<UiMessage>, leafId: String?): SessionTree {
    val ids = messages.mapTo(HashSet()) { it.id }
    val childrenOf = messages.groupBy { message -> message.parentId?.takeIf { it in ids } }
    val onPath = messages.activePath(leafId).mapTo(HashSet()) { it.id }
    val rows = mutableListOf<TreeRow>()
    rows.addNodes(TreeBuilder(childrenOf, onPath).children(null), depth = 0)
    return SessionTree(rows, rows.count { it.isLeaf })
}

private class TreeNode(val row: TreeRow, val children: List<TreeNode>)

private fun MutableList<TreeRow>.addNodes(nodes: List<TreeNode>, depth: Int) {
    val rowDepth = if (nodes.size > 1) depth + 1 else depth
    nodes.forEach { node ->
        add(node.row.copy(depth = rowDepth))
        addNodes(node.children, rowDepth)
    }
}

private class TreeBuilder(
    private val childrenOf: Map<String?, List<UiMessage>>,
    private val onPath: Set<String>,
) {
    private val visited = HashSet<String>()

    fun children(parentId: String?): List<TreeNode> =
        unvisitedChildren(parentId).map(::node).sortedByDescending { it.row.onPath }

    private fun unvisitedChildren(parentId: String?): List<UiMessage> =
        childrenOf[parentId].orEmpty().filter { it.id !in visited }

    private fun node(message: UiMessage): TreeNode {
        visited += message.id
        if (message.role == MessageRole.User) {
            val children = children(message.id)
            val row =
                TreeRow(
                    id = message.id,
                    question = true,
                    title = UiText.Raw(message.content),
                    label = message.label,
                    depth = 0,
                    onPath = message.id in onPath,
                    isLeaf = children.isEmpty(),
                )
            return TreeNode(row, children)
        }
        val chain = mutableListOf(message)
        var next = unvisitedChildren(message.id).singleOrNull()
        while (next != null && next.role != MessageRole.User) {
            visited += next.id
            chain += next
            next = unvisitedChildren(next.id).singleOrNull()
        }
        val tail = chain.last()
        val children = children(tail.id)
        val reply = chain.lastOrNull { it.role == MessageRole.Assistant } ?: tail
        val text = chain.lastOrNull { it.role == MessageRole.Assistant && it.content.isNotEmpty() }
        val row =
            TreeRow(
                id = tail.id,
                question = false,
                title =
                    text?.let { UiText.Raw(it.content) }
                        ?: reply.error
                        ?: UiText.Raw(reply.model.orEmpty()),
                label = chain.lastOrNull { it.label != null }?.label,
                depth = 0,
                onPath = chain.any { it.id in onPath },
                isLeaf = children.isEmpty(),
            )
        return TreeNode(row, children)
    }
}
