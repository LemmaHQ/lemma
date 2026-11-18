package io.github.mistvesper.lemma.ui.agent

/** One entry of the message list: a question, or the reply that answers it. */
internal sealed interface MessageEntry {
    val key: String

    /** A user [message]. */
    data class Question(val message: UiMessage) : MessageEntry {
        override val key
            get() = message.id
    }

    /**
     * The assistant [messages] that answer the question [questionId], oldest first, with the
     * [steps] they took; the last message holds the reply's text and how it ended.
     */
    data class Reply(val questionId: String?, val messages: List<UiMessage>) : MessageEntry {
        val steps = buildTurnSteps(messages)

        override val key
            get() = if (questionId == null) messages.first().id else "$questionId:reply"
    }
}

/** These user and assistant messages as list entries: each question, then one reply for it. */
internal fun List<UiMessage>.toEntries(): List<MessageEntry> = buildList {
    var questionId: String? = null
    val replyMessages = mutableListOf<UiMessage>()
    fun closeReply() {
        if (replyMessages.isNotEmpty()) add(MessageEntry.Reply(questionId, replyMessages.toList()))
        replyMessages.clear()
    }
    for (message in this@toEntries) {
        if (message.role == MessageRole.User) {
            closeReply()
            add(MessageEntry.Question(message))
            questionId = message.id
        } else {
            replyMessages += message
        }
    }
    closeReply()
}

/** The step [id] among the replies of these messages, or null when none has it. */
internal fun List<UiMessage>.findStep(id: String): TurnStep? =
    toEntries().filterIsInstance<MessageEntry.Reply>().firstNotNullOfOrNull { reply ->
        reply.steps.find { it.id == id }
    }
