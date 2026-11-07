package dev.lemmahq.lemma.network

import com.google.protobuf.Timestamp
import dev.lemmahq.gen.lemma.v1.MessageStatus as ProtoMessageStatus
import dev.lemmahq.gen.lemma.v1.ProviderKind
import dev.lemmahq.gen.lemma.v1.agentAborted
import dev.lemmahq.gen.lemma.v1.agentDelta
import dev.lemmahq.gen.lemma.v1.agentDone
import dev.lemmahq.gen.lemma.v1.agentError
import dev.lemmahq.gen.lemma.v1.agentEvent
import dev.lemmahq.gen.lemma.v1.agentStarted
import dev.lemmahq.gen.lemma.v1.agentTurnStarted
import dev.lemmahq.gen.lemma.v1.message
import dev.lemmahq.gen.lemma.v1.provider
import dev.lemmahq.gen.lemma.v1.textDelta
import dev.lemmahq.gen.lemma.v1.thinkingDelta
import dev.lemmahq.gen.lemma.v1.toolCall
import dev.lemmahq.gen.lemma.v1.toolCallFinished
import dev.lemmahq.gen.lemma.v1.toolCallStarted
import dev.lemmahq.gen.lemma.v1.toolResultMeta
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.MessageStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private val AT: Timestamp = Timestamp.newBuilder().setSeconds(12).setNanos(345_000_000).build()
private const val AT_MILLIS = 12_345L

class ProtoMappingTest {

    @Test
    fun providerKindsMapBothWaysAndUnknownKindsAreRejected() {
        val kinds = listOf("openai", "anthropic", "gemini")

        assertEquals(kinds, kinds.map { provider { kind = providerKind(it) }.toClient().kind })
        assertFailsWith<IllegalArgumentException> { providerKind("cohere") }
        assertFailsWith<IllegalArgumentException> {
            provider { kind = ProviderKind.PROVIDER_KIND_UNSPECIFIED }.toClient()
        }
        assertFailsWith<IllegalArgumentException> { provider { kindValue = 99 }.toClient() }
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
