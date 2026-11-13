package dev.lemmahq.lemma.network

import com.google.protobuf.Timestamp
import dev.lemmahq.gen.lemma.v1.ApiFormat
import dev.lemmahq.gen.lemma.v1.MessageStatus as ProtoMessageStatus
import dev.lemmahq.gen.lemma.v1.WebProvider
import dev.lemmahq.gen.lemma.v1.agentAborted
import dev.lemmahq.gen.lemma.v1.agentDelta
import dev.lemmahq.gen.lemma.v1.agentDone
import dev.lemmahq.gen.lemma.v1.agentError
import dev.lemmahq.gen.lemma.v1.agentEvent
import dev.lemmahq.gen.lemma.v1.agentStarted
import dev.lemmahq.gen.lemma.v1.agentTurnStarted
import dev.lemmahq.gen.lemma.v1.customProvider
import dev.lemmahq.gen.lemma.v1.message
import dev.lemmahq.gen.lemma.v1.model
import dev.lemmahq.gen.lemma.v1.predefinedProvider
import dev.lemmahq.gen.lemma.v1.provider
import dev.lemmahq.gen.lemma.v1.textDelta
import dev.lemmahq.gen.lemma.v1.thinkingDelta
import dev.lemmahq.gen.lemma.v1.toolCall
import dev.lemmahq.gen.lemma.v1.toolCallFinished
import dev.lemmahq.gen.lemma.v1.toolCallStarted
import dev.lemmahq.gen.lemma.v1.toolResultMeta
import dev.lemmahq.gen.lemma.v1.webProvider
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientCustomProvider
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.client.ClientPredefinedProvider
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.ClientWebProvider
import dev.lemmahq.lemma.client.ClientWebProviderKind
import dev.lemmahq.lemma.client.MessageStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private val AT: Timestamp = Timestamp.newBuilder().setSeconds(12).setNanos(345_000_000).build()
private const val AT_MILLIS = 12_345L

class ProtoMappingTest {

    @Test
    fun providerSourcesMapFormatsAndModelFeatures() {
        val formats = listOf("openai", "anthropic", "gemini")

        assertEquals(
            formats,
            formats.map { format ->
                val mapped = provider {
                    custom = customProvider { apiFormat = apiFormat(format) }
                }
                    .toClient()
                (mapped.source as ClientCustomProvider).apiFormat
            },
        )
        val predefined =
            provider {
                predefined = predefinedProvider {
                    identifier = "deepseek"
                    name = "DeepSeek"
                    apiFormats += ApiFormat.API_FORMAT_ANTHROPIC
                    apiFormats += ApiFormat.API_FORMAT_OPENAI
                    defaultApiFormat = ApiFormat.API_FORMAT_ANTHROPIC
                    models += model {
                        id = "deepseek-flash"
                        toolCalling = true
                    }
                    models += model { id = "deepseek-v4-pro" }
                }
            }
                .toClient()
                .source as ClientPredefinedProvider
        assertEquals(listOf("anthropic", "openai"), predefined.apiFormats)
        assertEquals("anthropic", predefined.defaultApiFormat)
        assertEquals(
            listOf(ClientModel("deepseek-flash", true), ClientModel("deepseek-v4-pro", false)),
            predefined.models,
        )

        assertFailsWith<IllegalArgumentException> { apiFormat("cohere") }
        assertFailsWith<IllegalArgumentException> {
            provider {
                custom = customProvider { apiFormat = ApiFormat.API_FORMAT_UNSPECIFIED }
            }
                .toClient()
        }
        assertFailsWith<IllegalArgumentException> {
            provider { custom = customProvider { apiFormatValue = 99 } }.toClient()
        }
        assertFailsWith<IllegalArgumentException> { provider {}.toClient() }
    }

    @Test
    fun webProvidersMapEachKindAndRejectUnknownValues() {
        val mapped =
            listOf(
                    WebProvider.Kind.KIND_NATIVE,
                    WebProvider.Kind.KIND_EXA,
                    WebProvider.Kind.KIND_DEEPSEEK,
                )
                .mapIndexed { index, kind ->
                    webProvider {
                        id = "web-$index"
                        this.kind = kind
                        name = "Web $index"
                        enabled = index == 0
                        hasKey = index == 1
                        searchRank = index
                        fetchRank = 2 - index
                    }
                        .toClient()
                }
        assertEquals(
            listOf(
                ClientWebProvider(
                    "web-0",
                    ClientWebProviderKind.Native,
                    "Web 0",
                    true,
                    false,
                    0,
                    2,
                ),
                ClientWebProvider("web-1", ClientWebProviderKind.Exa, "Web 1", false, true, 1, 1),
                ClientWebProvider(
                    "web-2",
                    ClientWebProviderKind.DeepSeek,
                    "Web 2",
                    false,
                    false,
                    2,
                    0,
                ),
            ),
            mapped,
        )
        assertFailsWith<IllegalArgumentException> { webProvider {}.toClient() }
        assertFailsWith<IllegalArgumentException> { webProvider { kindValue = 99 }.toClient() }
    }

    @Test
    fun aMessageWithoutAKnownStatusIsDone() {
        assertEquals(
            listOf(
                MessageStatus.Done,
                MessageStatus.Streaming,
                MessageStatus.Done,
                MessageStatus.Aborted,
                MessageStatus.Error,
                MessageStatus.Done,
            ),
            (ProtoMessageStatus.entries - ProtoMessageStatus.UNRECOGNIZED).map {
                message { status = it }.toClient().status
            } + message { statusValue = 99 }.toClient().status,
        )
    }

    @Test
    fun aMessageKeepsTheTimesAndResultTheServiceRecorded() {
        val recorded = message {
            id = "a1"
            role = "assistant"
            providerId = "openai"
            model = "gpt-4o"
            toolCalls += toolCall {
                id = "c1"
                name = "bash"
                arguments = "{}"
                startedAt = AT
                finishedAt = AT
            }
            toolCalls += toolCall {
                id = "c2"
                name = "read"
            }
            toolResult = toolResultMeta {
                toolCallId = "c0"
                isError = true
            }
            thinkingStartedAt = AT
            thinkingFinishedAt = AT
        }

        assertEquals(
            ClientMessage(
                id = "a1",
                role = "assistant",
                content = "",
                providerId = "openai",
                model = "gpt-4o",
                toolCalls =
                    listOf(
                        ClientToolCall("c1", "bash", "{}", AT_MILLIS, AT_MILLIS),
                        ClientToolCall("c2", "read", ""),
                    ),
                toolResult = ClientToolResult("c0", isError = true),
                thinkingStartedAt = AT_MILLIS,
                thinkingFinishedAt = AT_MILLIS,
            ),
            recorded.toClient(),
        )
        assertEquals(
            ClientMessage(id = "q1", role = "user", content = "Hi"),
            message {
                id = "q1"
                role = "user"
                content = "Hi"
            }
                .toClient(),
        )
    }

    @Test
    fun everyEventKindMapsWithTheTimeItOccurred() {
        val events =
            listOf(
                agentEvent { started = agentStarted { messageId = "q1" } },
                agentEvent { turnStarted = agentTurnStarted { messageId = "a1" } },
                agentEvent { delta = agentDelta { text = textDelta { content = "Hi" } } },
                agentEvent { delta = agentDelta { thinking = thinkingDelta { content = "Hm" } } },
                agentEvent { delta = agentDelta {} },
                agentEvent {
                    toolCallStarted = toolCallStarted {
                        callId = "c1"
                        name = "bash"
                        arguments = "{}"
                    }
                },
                agentEvent {
                    toolCallFinished = toolCallFinished {
                        callId = "c1"
                        content = "ok"
                        isError = true
                    }
                },
                agentEvent { done = agentDone {} },
                agentEvent { aborted = agentAborted {} },
                agentEvent { error = agentError { message = "boom" } },
                agentEvent {},
            )

        assertEquals(
            listOf(
                AgentStreamEvent.Started("q1", AT_MILLIS),
                AgentStreamEvent.TurnStarted("a1", AT_MILLIS),
                AgentStreamEvent.TextDelta("Hi", AT_MILLIS),
                AgentStreamEvent.ThinkingDelta("Hm", AT_MILLIS),
                AgentStreamEvent.Unknown(AT_MILLIS),
                AgentStreamEvent.ToolCallStarted("c1", "bash", "{}", AT_MILLIS),
                AgentStreamEvent.ToolCallFinished("c1", "ok", isError = true, AT_MILLIS),
                AgentStreamEvent.Done(AT_MILLIS),
                AgentStreamEvent.Aborted(AT_MILLIS),
                AgentStreamEvent.Error("boom", AT_MILLIS),
                AgentStreamEvent.Unknown(AT_MILLIS),
            ),
            events.map { it.toBuilder().setOccurredAt(AT).build().toStreamEvent() },
        )
        assertEquals(AgentStreamEvent.Done(), agentEvent { done = agentDone {} }.toStreamEvent())
    }
}
