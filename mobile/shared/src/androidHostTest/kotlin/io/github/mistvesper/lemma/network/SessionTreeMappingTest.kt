package io.github.mistvesper.lemma.network

import com.google.protobuf.Timestamp
import io.github.mistvesper.gen.lemma.v1.message
import io.github.mistvesper.gen.lemma.v1.session
import io.github.mistvesper.lemma.client.ClientSession
import kotlin.test.Test
import kotlin.test.assertEquals

private val AT: Timestamp = Timestamp.newBuilder().setSeconds(12).setNanos(345_000_000).build()
private const val AT_MILLIS = 12_345L

class SessionTreeMappingTest {

    @Test
    fun aSessionMapsItsLeafDirectoryAndRunningTurn() {
        assertEquals(
            ClientSession(
                id = "s1",
                title = "Trip",
                updatedAt = AT_MILLIS,
                leafId = "a1",
                directory = "/home/me/trip",
                activeMessageId = "q1",
            ),
            session {
                id = "s1"
                title = "Trip"
                updatedAt = AT
                leafId = "a1"
                directory = "/home/me/trip"
                activeMessageId = "q1"
            }
                .toClient(),
        )
        assertEquals(
            ClientSession("s2", "", AT_MILLIS),
            session {
                id = "s2"
                updatedAt = AT
            }
                .toClient(),
        )
    }

    @Test
    fun aMessageKeepsOnlyANonEmptyLabel() {
        assertEquals(
            listOf("Plan", null, null),
            listOf(
                    message { label = "Plan" },
                    message { label = "" },
                    message {},
                )
                .map { it.toClient().label },
        )
    }
}
