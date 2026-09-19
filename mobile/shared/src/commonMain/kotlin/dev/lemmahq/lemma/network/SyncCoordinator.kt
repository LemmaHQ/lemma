package dev.lemmahq.lemma.network

import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.PullResponse
import dev.lemmahq.gen.lemma.v1.pullRequest
import dev.lemmahq.lemma.data.LocalChatRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class SyncCoordinator(
    private val rpcClient: LemmaRpcClient,
    private val repository: LocalChatRepository
) {
    private val pullMutex = Mutex()

    suspend fun syncAll(): Boolean = pullMutex.withLock {
        try {
            var hasMore = true
            while (hasMore) {
                val cursor = repository.getCursor()
                val req = pullRequest {
                    this.after = cursor
                }

                when (val res = rpcClient.sync.pull(req, emptyMap())) {
                    is ResponseMessage.Success -> {
                        val message = res.message
                        applyPull(message)
                        hasMore = message.hasMore
                    }
                    is ResponseMessage.Failure -> {
                        return false
                    }
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private suspend fun applyPull(res: PullResponse) {
        for (syncConv in res.conversationsList) {
            val c = syncConv.conversation
            repository.saveConversation(
                id = c.id,
                title = c.title,
                status = c.statusValue.toLong(),
                createdAt = c.createdAt.seconds,
                updatedAt = c.updatedAt.seconds,
                syncSeq = syncConv.syncSeq
            )
        }

        for (syncMsg in res.messagesList) {
            val m = syncMsg.message
            repository.saveMessage(
                id = m.id,
                conversationId = m.conversationId,
                role = if (m.role == "user") 1L else 2L,
                content = m.content,
                status = m.statusValue.toLong(),
                createdAt = m.createdAt.seconds,
                updatedAt = m.updatedAt.seconds,
                syncSeq = syncMsg.syncSeq
            )
        }

        if (res.activeList.isNotEmpty()) {
            val activeIds = res.activeList.map { it.id }.toSet()
            repository.pruneConversationsNotIn(activeIds)
        }

        if (res.nextAfter > repository.getCursor()) {
            repository.setCursor(res.nextAfter)
        }
    }
}
