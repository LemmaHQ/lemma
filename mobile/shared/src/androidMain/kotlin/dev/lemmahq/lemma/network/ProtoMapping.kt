package dev.lemmahq.lemma.network

import com.google.protobuf.Timestamp
import dev.lemmahq.gen.lemma.v1.AgentDelta
import dev.lemmahq.gen.lemma.v1.AgentEvent
import dev.lemmahq.gen.lemma.v1.Message
import dev.lemmahq.gen.lemma.v1.MessageStatus as ProtoMessageStatus
import dev.lemmahq.gen.lemma.v1.Provider
import dev.lemmahq.gen.lemma.v1.ProviderKind
import dev.lemmahq.gen.lemma.v1.Session
import dev.lemmahq.gen.lemma.v1.ToolCall
import dev.lemmahq.gen.lemma.v1.User
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.ClientUser
import dev.lemmahq.lemma.client.MessageStatus
import kotlin.time.Duration.Companion.nanoseconds
import kotlin.time.Duration.Companion.seconds

internal fun User.toClient(): ClientUser = ClientUser(id = id, username = username)

internal fun Provider.toClient(): ClientProvider =
    ClientProvider(
        id = id,
        kind = kind.toClientKind(),
        identifier = identifier,
        name = name,
        baseUrl = baseUrl,
        apiPath = apiPath,
        modelsPath = modelsPath,
        models = modelsList,
        enabled = enabled,
        apiKey = apiKey,
    )

internal fun providerKind(kind: String): ProviderKind =
    when (kind) {
        "openai" -> ProviderKind.PROVIDER_KIND_OPENAI
        "anthropic" -> ProviderKind.PROVIDER_KIND_ANTHROPIC
        "gemini" -> ProviderKind.PROVIDER_KIND_GEMINI
        else -> throw IllegalArgumentException("Unknown provider kind: $kind")
    }

internal fun Session.toClient(): ClientSession =
    ClientSession(id = id, title = title, updatedAt = updatedAt.epochMillis())

internal fun Message.toClient(): ClientMessage =
    ClientMessage(
        id = id,
        role = role,
        content = content,
        thinking = thinking,
        status = status.toClient(),
        error = error,
        providerId = providerId.ifBlank { null },
        model = model.ifBlank { null },
        toolCalls = toolCallsList.map { it.toClient() },
        toolResult =
            if (hasToolResult()) ClientToolResult(toolResult.toolCallId, toolResult.isError)
            else null,
        thinkingStartedAt = if (hasThinkingStartedAt()) thinkingStartedAt.epochMillis() else null,
        thinkingFinishedAt =
            if (hasThinkingFinishedAt()) thinkingFinishedAt.epochMillis() else null,
    )

internal fun AgentEvent.toStreamEvent(): AgentStreamEvent {
    val at = if (hasOccurredAt()) occurredAt.epochMillis() else null
    val kind: AgentEvent.KindCase = kindCase
    return when (kind) {
        AgentEvent.KindCase.STARTED -> AgentStreamEvent.Started(started.messageId, at)
        AgentEvent.KindCase.TURN_STARTED -> AgentStreamEvent.TurnStarted(turnStarted.messageId, at)
        AgentEvent.KindCase.DELTA ->
            when (delta.partCase) {
                AgentDelta.PartCase.TEXT -> AgentStreamEvent.TextDelta(delta.text.content, at)
                AgentDelta.PartCase.THINKING ->
                    AgentStreamEvent.ThinkingDelta(delta.thinking.content, at)
                AgentDelta.PartCase.PART_NOT_SET -> AgentStreamEvent.Unknown(at)
            }
        AgentEvent.KindCase.TOOL_CALL_STARTED ->
            AgentStreamEvent.ToolCallStarted(
                callId = toolCallStarted.callId,
                name = toolCallStarted.name,
                arguments = toolCallStarted.arguments,
                occurredAt = at,
            )
        AgentEvent.KindCase.TOOL_CALL_FINISHED ->
            AgentStreamEvent.ToolCallFinished(
                callId = toolCallFinished.callId,
                content = toolCallFinished.content,
                isError = toolCallFinished.isError,
                occurredAt = at,
            )
        AgentEvent.KindCase.DONE -> AgentStreamEvent.Done(at)
        AgentEvent.KindCase.ABORTED -> AgentStreamEvent.Aborted(at)
        AgentEvent.KindCase.ERROR -> AgentStreamEvent.Error(error.message, at)
        AgentEvent.KindCase.KIND_NOT_SET -> AgentStreamEvent.Unknown(at)
    }
}

private fun ProviderKind.toClientKind(): String =
    when (this) {
        ProviderKind.PROVIDER_KIND_OPENAI -> "openai"
        ProviderKind.PROVIDER_KIND_ANTHROPIC -> "anthropic"
        ProviderKind.PROVIDER_KIND_GEMINI -> "gemini"
        ProviderKind.PROVIDER_KIND_UNSPECIFIED,
        ProviderKind.UNRECOGNIZED -> throw IllegalArgumentException("Unknown provider kind: $this")
    }

private fun ProtoMessageStatus.toClient(): MessageStatus =
    when (this) {
        ProtoMessageStatus.MESSAGE_STATUS_STREAMING -> MessageStatus.Streaming
        ProtoMessageStatus.MESSAGE_STATUS_ABORTED -> MessageStatus.Aborted
        ProtoMessageStatus.MESSAGE_STATUS_ERROR -> MessageStatus.Error
        ProtoMessageStatus.MESSAGE_STATUS_DONE,
        ProtoMessageStatus.MESSAGE_STATUS_UNSPECIFIED,
        ProtoMessageStatus.UNRECOGNIZED -> MessageStatus.Done
    }

private fun ToolCall.toClient(): ClientToolCall =
    ClientToolCall(
        id = id,
        name = name,
        arguments = arguments,
        startedAt = if (hasStartedAt()) startedAt.epochMillis() else null,
        finishedAt = if (hasFinishedAt()) finishedAt.epochMillis() else null,
    )

private fun Timestamp.epochMillis(): Long =
    (seconds.seconds + nanos.nanoseconds).inWholeMilliseconds
