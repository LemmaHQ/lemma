package dev.lemmahq.lemma.network

import com.google.protobuf.Timestamp
import dev.lemmahq.gen.lemma.v1.AgentDelta
import dev.lemmahq.gen.lemma.v1.AgentEvent
import dev.lemmahq.gen.lemma.v1.ApiFormat
import dev.lemmahq.gen.lemma.v1.Message
import dev.lemmahq.gen.lemma.v1.MessageStatus as ProtoMessageStatus
import dev.lemmahq.gen.lemma.v1.Model
import dev.lemmahq.gen.lemma.v1.Provider
import dev.lemmahq.gen.lemma.v1.Session
import dev.lemmahq.gen.lemma.v1.ToolCall
import dev.lemmahq.gen.lemma.v1.User
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientCustomProvider
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.client.ClientPredefinedProvider
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
        enabled = enabled,
        apiKey = apiKey,
        source =
            when {
                hasPredefined() ->
                    ClientPredefinedProvider(
                        identifier = predefined.identifier,
                        name = predefined.name,
                        apiFormats = predefined.apiFormatsList.map { it.toClientFormat() },
                        defaultApiFormat = predefined.defaultApiFormat.toClientFormat(),
                        models = predefined.modelsList.map { it.toClient() },
                    )
                hasCustom() ->
                    ClientCustomProvider(
                        identifier = custom.identifier,
                        name = custom.name,
                        apiFormat = custom.apiFormat.toClientFormat(),
                        baseUrl = custom.baseUrl,
                        apiPath = custom.apiPath,
                        modelsPath = custom.modelsPath,
                        models = custom.modelsList.map { it.toClient() },
                    )
                else -> throw IllegalArgumentException("Provider source is not set")
            },
    )

internal fun apiFormat(format: String): ApiFormat =
    when (format) {
        "openai" -> ApiFormat.API_FORMAT_OPENAI
        "anthropic" -> ApiFormat.API_FORMAT_ANTHROPIC
        "gemini" -> ApiFormat.API_FORMAT_GEMINI
        else -> throw IllegalArgumentException("Unknown API format: $format")
    }

internal fun ClientModel.toProto(): Model =
    Model.newBuilder().setId(id).setToolCalling(toolCalling).build()

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

private fun ApiFormat.toClientFormat(): String =
    when (this) {
        ApiFormat.API_FORMAT_OPENAI -> "openai"
        ApiFormat.API_FORMAT_ANTHROPIC -> "anthropic"
        ApiFormat.API_FORMAT_GEMINI -> "gemini"
        ApiFormat.API_FORMAT_UNSPECIFIED,
        ApiFormat.UNRECOGNIZED -> throw IllegalArgumentException("Unknown API format: $this")
    }

private fun Model.toClient(): ClientModel = ClientModel(id = id, toolCalling = toolCalling)

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
