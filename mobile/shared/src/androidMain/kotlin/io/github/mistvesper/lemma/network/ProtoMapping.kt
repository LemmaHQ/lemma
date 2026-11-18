package io.github.mistvesper.lemma.network

import com.google.protobuf.Timestamp
import io.github.mistvesper.gen.lemma.v1.AgentDelta
import io.github.mistvesper.gen.lemma.v1.AgentEvent
import io.github.mistvesper.gen.lemma.v1.ApiFormat as ProtoApiFormat
import io.github.mistvesper.gen.lemma.v1.Message
import io.github.mistvesper.gen.lemma.v1.MessageStatus as ProtoMessageStatus
import io.github.mistvesper.gen.lemma.v1.Model
import io.github.mistvesper.gen.lemma.v1.Provider
import io.github.mistvesper.gen.lemma.v1.Session
import io.github.mistvesper.gen.lemma.v1.ToolCall
import io.github.mistvesper.gen.lemma.v1.WebProvider
import io.github.mistvesper.lemma.client.AgentStreamEvent
import io.github.mistvesper.lemma.client.ApiFormat
import io.github.mistvesper.lemma.client.ClientCustomProvider
import io.github.mistvesper.lemma.client.ClientMessage
import io.github.mistvesper.lemma.client.ClientModel
import io.github.mistvesper.lemma.client.ClientPredefinedProvider
import io.github.mistvesper.lemma.client.ClientProvider
import io.github.mistvesper.lemma.client.ClientSession
import io.github.mistvesper.lemma.client.ClientToolCall
import io.github.mistvesper.lemma.client.ClientToolResult
import io.github.mistvesper.lemma.client.ClientWebProvider
import io.github.mistvesper.lemma.client.ClientWebProviderKind
import io.github.mistvesper.lemma.client.MessageStatus
import kotlin.time.Duration.Companion.nanoseconds
import kotlin.time.Duration.Companion.seconds

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
                        apiFormats = predefined.apiFormatsList.map { it.toClient() },
                        defaultApiFormat = predefined.defaultApiFormat.toClient(),
                        models = predefined.modelsList.map { it.toClient() },
                    )
                hasCustom() ->
                    ClientCustomProvider(
                        identifier = custom.identifier,
                        name = custom.name,
                        apiFormat = custom.apiFormat.toClient(),
                        baseUrl = custom.baseUrl,
                        apiPath = custom.apiPath,
                        modelsPath = custom.modelsPath,
                        models = custom.modelsList.map { it.toClient() },
                    )
                else -> throw IllegalArgumentException("Provider source is not set")
            },
    )

internal fun WebProvider.toClient(): ClientWebProvider =
    ClientWebProvider(
        id = id,
        kind = kind.toClient(),
        name = name,
        enabled = enabled,
        apiKey = apiKey,
        searchRank = searchRank,
        fetchRank = fetchRank,
    )

internal fun ApiFormat.toProto(): ProtoApiFormat =
    when (this) {
        ApiFormat.OpenAi -> ProtoApiFormat.API_FORMAT_OPENAI
        ApiFormat.Anthropic -> ProtoApiFormat.API_FORMAT_ANTHROPIC
        ApiFormat.Gemini -> ProtoApiFormat.API_FORMAT_GEMINI
    }

internal fun ClientModel.toProto(): Model =
    Model.newBuilder().setId(id).setToolCalling(toolCalling).build()

internal fun Session.toClient(): ClientSession =
    ClientSession(
        id = id,
        title = title,
        updatedAt = updatedAt.epochMillis(),
        leafId = if (hasLeafId()) leafId else null,
        directory = if (hasDirectory()) directory else null,
        activeMessageId = if (hasActiveMessageId()) activeMessageId else null,
    )

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
        parentId = if (hasParentId()) parentId else null,
        label = label.ifBlank { null },
        createdAt = if (hasCreatedAt()) createdAt.epochMillis() else null,
    )

internal fun AgentEvent.toStreamEvent(): AgentStreamEvent {
    val at = if (hasOccurredAt()) occurredAt.epochMillis() else null
    val kind: AgentEvent.KindCase = kindCase
    return when (kind) {
        AgentEvent.KindCase.STARTED ->
            AgentStreamEvent.Started(messageId = started.messageId, occurredAt = at)
        AgentEvent.KindCase.TURN_STARTED ->
            AgentStreamEvent.TurnStarted(messageId = turnStarted.messageId, occurredAt = at)
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

private fun ProtoApiFormat.toClient(): ApiFormat =
    when (this) {
        ProtoApiFormat.API_FORMAT_OPENAI -> ApiFormat.OpenAi
        ProtoApiFormat.API_FORMAT_ANTHROPIC -> ApiFormat.Anthropic
        ProtoApiFormat.API_FORMAT_GEMINI -> ApiFormat.Gemini
        ProtoApiFormat.API_FORMAT_UNSPECIFIED,
        ProtoApiFormat.UNRECOGNIZED -> throw IllegalArgumentException("Unknown API format: $this")
    }

private fun WebProvider.Kind.toClient(): ClientWebProviderKind =
    when (this) {
        WebProvider.Kind.KIND_NATIVE -> ClientWebProviderKind.Native
        WebProvider.Kind.KIND_EXA -> ClientWebProviderKind.Exa
        WebProvider.Kind.KIND_DEEPSEEK -> ClientWebProviderKind.DeepSeek
        WebProvider.Kind.KIND_UNSPECIFIED,
        WebProvider.Kind.UNRECOGNIZED ->
            throw IllegalArgumentException("Unknown web provider kind: $this")
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
