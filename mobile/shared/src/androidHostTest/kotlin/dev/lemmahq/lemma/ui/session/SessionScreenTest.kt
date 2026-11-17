package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.lifecycle.SavedStateHandle
import androidx.test.espresso.Espresso
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientMessageTree
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.sampleMessage
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.client.sampleSession
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.agent.AgentViewModel
import dev.lemmahq.lemma.ui.agent.SessionStage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SessionScreenTest {

    @get:Rule val compose = createComposeRule()

    private val client =
        FakeLemmaClient().apply {
            onListProviders = { listOf(sampleProvider("openai", "gpt-4o")) }
            onListSessions = {
                listOf(
                    sampleSession("trip", "Trip", updatedAt = System.currentTimeMillis()),
                    sampleSession("old", "Old", updatedAt = 0),
                )
            }
        }

    private fun showSession() {
        val agent = AgentViewModel(client, SettingsRepository(MapSettings()), SavedStateHandle())
        val sessions = SessionListViewModel(client, agent)
        compose.setContent {
            LemmaTheme {
                SessionScreen(
                    sessions = sessions,
                    openSessionId = agent.openSession?.id,
                    onNewSession = agent::newSession,
                    onOpenSettings = {},
                ) { openDrawer ->
                    SessionStage(
                        viewModel = agent,
                        sessionTitle = sessions.currentSession?.title,
                        createSession = sessions::createSession,
                        onOpenDrawer = openDrawer,
                        onManageProviders = {},
                    )
                }
            }
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun theDrawerGroupsSessionsAndRenamesOrDeletesThem() {
        showSession()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("Today").assertIsDisplayed()
        compose.onNodeWithText("Earlier").assertIsDisplayed()

        compose.onAllNodesWithContentDescription("More actions")[0].performClick()
        compose.onNodeWithText("Rename").performClick()
        compose.onNode(hasSetTextAction() and hasText("Trip")).performTextReplacement("Paris")
        compose.onNodeWithText("Save").performClick()
        compose.onNodeWithText("Paris").assertIsDisplayed()

        compose.onAllNodesWithContentDescription("More actions")[1].performClick()
        compose.onNodeWithText("Delete permanently").performClick()
        compose.onNodeWithText("Permanently delete this session?").assertIsDisplayed()
        compose.onAllNodesWithText("Delete permanently")[0].performClick()
        compose.onNodeWithText("Old").assertDoesNotExist()

        assertEquals(
            listOf(Call("renameSession", "trip", "Paris"), Call("deleteSession", "old")),
            client.calls.filter { it.name == "renameSession" || it.name == "deleteSession" },
        )
    }

    @Test
    fun backClosesTheOpenDrawer() {
        showSession()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("Today").assertIsDisplayed()
        Espresso.pressBack()
        compose.onNodeWithText("Today").assertIsNotDisplayed()
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
    }

    @Test
    fun backClosesTheModelSheet() {
        showSession()

        compose.onNodeWithText("gpt-4o").performClick()
        compose.onNodeWithText("Manage providers").assertIsDisplayed()
        Espresso.pressBack()
        compose.onNodeWithText("Manage providers").assertDoesNotExist()
    }

    @Test
    fun theDrawerShowsEachSessionsTimeOrItsMarker() {
        val juneNoonUtc = 1_592_222_400_000L
        client.onListSessions = {
            listOf(
                ClientSession("live", "Live", System.currentTimeMillis(), activeMessageId = "q1"),
                sampleSession("june", "June", updatedAt = juneNoonUtc),
            )
        }
        showSession()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithContentDescription("Running").assertIsDisplayed()
        compose.onNodeWithText("2020-06-15").assertIsDisplayed()
    }

    @Test
    fun finishedAndFailedRowsShowTheirMarkerInPlaceOfTheTime() {
        compose.setContent {
            LemmaTheme {
                Column {
                    for (marker in listOf(SessionMarker.Finished, SessionMarker.Failed)) {
                        SessionRow(
                            session = sampleSession(marker.name),
                            time = "09:05",
                            marker = marker,
                            selected = false,
                            onSelect = {},
                            onRename = {},
                            onDelete = {},
                        )
                    }
                }
            }
        }

        compose.onNodeWithContentDescription("Reply finished, not viewed").assertIsDisplayed()
        compose.onNodeWithContentDescription("Last reply failed").assertIsDisplayed()
        compose.onNodeWithText("09:05").assertDoesNotExist()
    }

    @Test
    fun theDrawerSwitchesSessionsGroupedByDay() {
        val day = 24 * 60 * 60 * 1_000L
        val now = System.currentTimeMillis()
        client.onListSessions = {
            listOf(
                sampleSession("call", "Call", updatedAt = now - day),
                sampleSession("plan", "Plan", updatedAt = now - 3 * day),
            )
        }
        client.onListMessages = { sessionId ->
            ClientMessageTree(
                listOf(
                    sampleMessage("$sessionId-q", "user"),
                    ClientMessage(
                        "$sessionId-a",
                        "assistant",
                        "",
                        toolCalls = listOf(ClientToolCall("c1", "bash", "{}", startedAt = 1_000)),
                        parentId = "$sessionId-q",
                    ),
                ),
                leafId = "$sessionId-a",
            )
        }
        showSession()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("Yesterday").assertIsDisplayed()
        compose.onNodeWithText("Last 7 days").assertIsDisplayed()
        compose.onNodeWithText("Plan").performClick()
        waitForText("plan-q")
        compose.onNodeWithText("ran {}").assertExists()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("New session").performClick()
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
    }

    @Test
    fun readingOlderMessagesIsNotInterruptedUntilAskedToReturn() {
        val history =
            (1..30).flatMap { index ->
                val prevAssistant = if (index == 1) null else "a${index - 1}"
                listOf(
                    sampleMessage("q$index", "user", parentId = prevAssistant),
                    sampleMessage("a$index", "assistant", parentId = "q$index"),
                )
            }
        val q31 = sampleMessage("q31", "user", parentId = "a30")
        val running =
            ClientMessage(
                "a31",
                "assistant",
                "",
                status = MessageStatus.Streaming,
                parentId = "q31",
            )
        client.onListSessions = { listOf(sampleSession("long", "Long")) }
        client.onListMessages = {
            ClientMessageTree(
                history + listOf(q31, running),
                leafId = "a31",
                activeMessageId = "q31",
            )
        }
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onResumeStream = { _, _ -> events.consumeAsFlow() }
        showSession()
        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("Long").performClick()
        waitForText("q31")

        compose
            .onNode(hasScrollToIndexAction() and hasAnyDescendant(hasText("q31")))
            .performTouchInput {
                swipeDown()
                swipeDown()
            }
        events.trySend(AgentStreamEvent.Started("q31"))
        events.trySend(AgentStreamEvent.TurnStarted("a31"))
        events.trySend(AgentStreamEvent.TurnStarted("a32"))
        events.trySend(AgentStreamEvent.TextDelta("Still here"))
        compose.onNodeWithText("Still here").assertDoesNotExist()

        compose.onNodeWithContentDescription("Scroll to latest").performClick()
        compose.onNodeWithText("Still here").assertIsDisplayed()
        compose.onNodeWithContentDescription("Scroll to latest").assertDoesNotExist()
    }
}
