package dev.lemmahq.lemma.ui.session

import android.content.ClipboardManager
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
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
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.lifecycle.SavedStateHandle
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientMessagePage
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleMessage
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.client.sampleSession
import dev.lemmahq.lemma.data.DriverFactory
import dev.lemmahq.lemma.data.InMemoryTokenStore
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.db.LemmaDatabase
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

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
    private var providerRequests = 0

    private fun showSession() {
        val viewModel =
            SessionViewModel(
                client,
                SettingsRepository(MapSettings(), InMemoryTokenStore()),
                LocalMessageRepository(
                    LemmaDatabase(DriverFactory(RuntimeEnvironment.getApplication()).createDriver())
                ),
                SavedStateHandle(),
            )
        compose.setContent {
            LemmaTheme {
                SessionScreen(
                    viewModel = viewModel,
                    username = "ada",
                    onManageProviders = { providerRequests++ },
                    onOpenSettings = {},
                    onLoadAccount = {},
                    onSignOut = {},
                )
            }
        }
    }

    private fun send(text: String) {
        compose.onNode(hasSetTextAction()).performTextInput(text)
        compose.onNodeWithContentDescription("Send").performClick()
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
    fun aReplyShowsItsThinkingAndToolCallsOnRequest() {
        client.onSendMessage = { _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ThinkingDelta("Need the date"),
                AgentStreamEvent.ToolCallStarted("c1", "bash", """{"cmd":"date"}"""),
                AgentStreamEvent.ToolCallFinished("c1", "Fri", isError = false),
                AgentStreamEvent.TurnStarted("a2"),
                AgentStreamEvent.Error("upstream closed"),
            )
        }
        showSession()

        send("What day is it?")

        compose.onNodeWithText("The model request failed").assertIsDisplayed()
        compose.onNodeWithText("upstream closed").assertIsDisplayed()
        compose.onNodeWithText("Thought").performClick()
        compose.onNodeWithText("Need the date").assertIsDisplayed()
        compose.onNodeWithText("Used 1 tool").performClick()
        compose.onNodeWithText("bash").performClick()
        compose.onNodeWithText("{\n  \"cmd\": \"date\"\n}").assertIsDisplayed()
        compose.onNodeWithText("Fri").assertIsDisplayed()
    }

    @Test
    fun aSettledReplyCopiesItsTextAndNamesItsModel() {
        client.onSendMessage = { _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.TextDelta("Hello there"),
                AgentStreamEvent.Done(),
            )
        }
        showSession()

        send("Hi")

        compose.onNodeWithText("openai · gpt-4o").assertIsDisplayed()
        compose.onNodeWithContentDescription("Copy").performClick()
        val clipboard =
            RuntimeEnvironment.getApplication().getSystemService(ClipboardManager::class.java)
        assertEquals("Hello there", clipboard.primaryClip?.getItemAt(0)?.text.toString())
        compose.onNodeWithContentDescription("Copied").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(2_000)
        compose.onNodeWithContentDescription("Copy").assertIsDisplayed()
        compose.onNodeWithContentDescription("Regenerate").performClick()
        assertEquals(2, client.calls.count { it.name == "sendMessage" })
    }

    @Test
    fun aSuggestionFillsTheComposerOfANewSession() {
        showSession()

        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
        compose.onNodeWithText("Help me debug an issue").performClick()

        compose.onNode(hasSetTextAction()).assert(hasText("Help me debug an issue"))
    }

    @Test
    fun aStepThatStreamsNothingYetShowsThatTheModelThinks() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _ -> events.consumeAsFlow() }
        showSession()

        send("Hello")
        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.ToolCallStarted("c1", "bash", "{}"))
        compose.onNodeWithText("Using 1 tool…").assertIsDisplayed()

        events.trySend(AgentStreamEvent.TurnStarted("a2"))
        compose.onNodeWithText("Thinking").assertIsDisplayed()
        events.trySend(AgentStreamEvent.Aborted())
        compose.onNodeWithText("Generation stopped.").assertIsDisplayed()
    }

    @Test
    fun aFailureOutsideATurnOffersNoRetry() {
        client.onListProviders = { throw ServiceException(ServiceFailure.Network) }
        showSession()

        compose
            .onNodeWithText("Cannot reach the server, check your connection and try again")
            .assertIsDisplayed()
        compose.onNodeWithText("Retry").assertDoesNotExist()
    }

    @Test
    fun aFailedTurnOffersToRetryOrDismissItsReason() {
        client.onSendMessage = { _, _, _, _ ->
            flow { throw ServiceException(ServiceFailure.Network) }
        }
        showSession()

        send("Hello")
        compose.onNodeWithText("Retry").performClick()
        compose.onNode(hasSetTextAction()).assert(hasText("Hello"))
        compose.onNodeWithContentDescription("Send").performClick()
        compose.onNodeWithContentDescription("Close").performClick()

        compose.onNodeWithText("Retry").assertDoesNotExist()
        compose
            .onAllNodesWithText("Cannot reach the server, check your connection and try again")
            .assertCountEquals(2)
    }

    @Test
    fun theModelPickerSwitchesModelsAndLeadsToTheProviders() {
        client.onListProviders = {
            listOf(
                sampleProvider("openai", "gpt-4o", "gpt-4o-mini"),
                sampleProvider("off", "m1", enabled = false),
            )
        }
        showSession()

        compose.onNodeWithText("gpt-4o").performClick()
        compose.onNodeWithText("m1").assertDoesNotExist()
        compose.onNodeWithText("gpt-4o-mini").performClick()
        compose.onNodeWithText("Manage providers").assertDoesNotExist()
        compose.onNodeWithText("gpt-4o-mini").performClick()
        compose.onNodeWithText("Manage providers").performClick()

        compose.onNodeWithText("Manage providers").assertDoesNotExist()
        assertEquals(1, providerRequests)
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
        client.onListMessages = { sessionId, _ ->
            ClientMessagePage(
                listOf(
                    ClientMessage(
                        "$sessionId-a",
                        "assistant",
                        "",
                        toolCalls = listOf(ClientToolCall("c1", "bash", "{}", startedAt = 1_000)),
                    ),
                    sampleMessage("$sessionId-q", "user"),
                ),
                hasMore = false,
            )
        }
        showSession()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("Yesterday").assertIsDisplayed()
        compose.onNodeWithText("Last 7 days").assertIsDisplayed()
        compose.onNodeWithText("Plan").performClick()
        waitForText("plan-q")
        compose.onNodeWithText("Used 1 tool").assertExists()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("New session").performClick()
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
    }

    @Test
    fun aThinkingStepCountsItsTimeAndClosesOnceItEnds() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _ -> events.consumeAsFlow() }
        showSession()
        val start = System.currentTimeMillis()

        send("Plan a trip")
        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.TurnStarted("a1"))
        events.trySend(AgentStreamEvent.ThinkingDelta("Check the weather", start))
        compose.onNodeWithText("Thinking…", substring = true).assertIsDisplayed()
        events.trySend(AgentStreamEvent.ThinkingDelta(" first", start + 500))
        waitForText("Check the weather first")

        events.trySend(AgentStreamEvent.TextDelta("Pack light", start + 1_500))
        compose.onNodeWithText("Thought for 1.5s").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(1_000)
        compose.onNodeWithText("Check the weather first").assertDoesNotExist()
        events.trySend(AgentStreamEvent.Done(start + 2_000))
        compose.onNodeWithText("Pack light").assertIsDisplayed()
    }

    @Test
    fun toolCallsShowFailuresWaitingResultsAndLongArguments() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _ -> events.consumeAsFlow() }
        showSession()
        val start = System.currentTimeMillis() - 5_000
        val arguments = (1..40).joinToString(",", "{", "}") { "\"key$it\":$it" }

        send("Read the files")
        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.TurnStarted("a1"))
        events.trySend(AgentStreamEvent.ToolCallStarted("c1", "bash", "", start))
        events.trySend(AgentStreamEvent.ToolCallFinished("c1", "denied", true, start + 1_200))
        events.trySend(AgentStreamEvent.ToolCallStarted("c2", "read", arguments, start + 1_300))
        compose.onNodeWithText("· 1 failed").assertIsDisplayed()
        compose.onNodeWithText("Using 2 tools…").performClick()
        compose.onNodeWithText("denied").assertIsDisplayed()
        compose.onNodeWithText("read").performClick()
        compose.onNodeWithText("Waiting for result…").assertIsDisplayed()
        compose.onNodeWithText("Show all").performScrollTo().performClick()
        compose.onNodeWithText("Show less").assertIsDisplayed()

        compose.onNodeWithText("read").performClick()
        events.trySend(AgentStreamEvent.ToolCallFinished("c2", "ok", false, start + 2_000))
        events.trySend(AgentStreamEvent.Done(start + 2_100))
        compose.onNodeWithText("Used 2 tools").assertExists()
        compose.onNodeWithText("· 1.9s").assertExists()
    }

    @Test
    fun readingOlderMessagesIsNotInterruptedUntilAskedToReturn() {
        val history =
            (30 downTo 1).flatMap {
                listOf(sampleMessage("a$it", "assistant"), sampleMessage("q$it", "user"))
            }
        val running = ClientMessage("a31", "assistant", "", status = MessageStatus.Streaming)
        client.onListSessions = { listOf(sampleSession("long", "Long")) }
        client.onListMessages = { _, _ ->
            ClientMessagePage(
                listOf(running, sampleMessage("q31", "user")) + history,
                hasMore = false,
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
        events.trySend(AgentStreamEvent.TextDelta("Still here"))
        events.trySend(AgentStreamEvent.TurnStarted("a32"))
        compose.onNodeWithText("Still here").assertDoesNotExist()

        compose.onNodeWithContentDescription("Scroll to latest").performClick()
        compose.onNodeWithText("Still here").assertIsDisplayed()
        compose.onNodeWithContentDescription("Scroll to latest").assertDoesNotExist()
    }
}
