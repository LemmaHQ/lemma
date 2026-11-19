package io.github.mistvesper.lemma.ui.agent

import android.content.ClipboardManager
import android.os.Looper
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.text.AnnotatedString
import androidx.lifecycle.SavedStateHandle
import androidx.test.espresso.Espresso
import com.russhwolf.settings.MapSettings
import io.github.mistvesper.lemma.client.AgentStreamEvent
import io.github.mistvesper.lemma.client.ClientMessage
import io.github.mistvesper.lemma.client.ClientMessageTree
import io.github.mistvesper.lemma.client.ClientToolCall
import io.github.mistvesper.lemma.client.ClientToolResult
import io.github.mistvesper.lemma.client.FakeLemmaClient
import io.github.mistvesper.lemma.client.FakeLemmaClient.Call
import io.github.mistvesper.lemma.client.MessageStatus
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.client.ServiceFailure
import io.github.mistvesper.lemma.client.sampleMessage
import io.github.mistvesper.lemma.client.sampleProvider
import io.github.mistvesper.lemma.client.sampleSession
import io.github.mistvesper.lemma.data.SettingsRepository
import io.github.mistvesper.lemma.theme.LemmaTheme
import java.time.Duration
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

private const val TALL_SCREEN = "w411dp-h891dp"

@RunWith(RobolectricTestRunner::class)
class SessionStageTest {

    @get:Rule val compose = createComposeRule()

    private val client =
        FakeLemmaClient().apply { onListProviders = { listOf(sampleProvider("openai", "gpt-4o")) } }
    private var providerRequests = 0
    private val unreachable = "Connection failed, try again"
    private val elapsedTime =
        SemanticsMatcher("shows the elapsed time") { node ->
            node.config
                .getOrElse(SemanticsProperties.Text) { emptyList() }
                .any {
                    it.text.matches(Regex("""\d+\.\ds"""))
                }
        }

    private fun showStage(): AgentViewModel {
        val viewModel =
            AgentViewModel(client, SettingsRepository(MapSettings()), SavedStateHandle())
        compose.setContent {
            LemmaTheme {
                SessionStage(
                    viewModel = viewModel,
                    sessionTitle = null,
                    createSession = client::createSession,
                    onOpenDrawer = {},
                    onManageProviders = { providerRequests++ },
                )
            }
        }
        return viewModel
    }

    private fun elapsedSeconds(): Double =
        compose
            .onNode(elapsedTime)
            .fetchSemanticsNode()
            .config[SemanticsProperties.Text]
            .first()
            .text
            .removeSuffix("s")
            .toDouble()

    private fun lastSend() = client.calls.last { it.name == "sendMessage" }

    private fun send(text: String) {
        compose.onNode(hasSetTextAction()).performTextInput(text)
        compose.onNodeWithContentDescription("Send").performClick()
    }

    private fun waitForText(text: String) {
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun store(vararg messages: ClientMessage) {
        val tree = ClientMessageTree(messages.toList(), leafId = messages.last().id)
        client.onListMessages = { tree }
    }

    private fun reply(id: String, parentId: String, content: String = "") =
        ClientMessage(
            id,
            "assistant",
            content,
            providerId = "openai",
            model = "gpt-4o",
            parentId = parentId,
        )

    private fun toolOutput(id: String, parentId: String, callId: String, content: String) =
        ClientMessage(
            id,
            "tool",
            content,
            toolResult = ClientToolResult(callId, isError = false),
            parentId = parentId,
        )

    @Test
    fun aReplyShowsItsThinkingAndToolCallsInOneTimelineWhoseStepsOpenTheirDetails() {
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ThinkingDelta("Need the date\n\nCheck the clock"),
                AgentStreamEvent.ToolCallStarted("c1", "bash", """{"cmd":"date"}"""),
                AgentStreamEvent.ToolCallFinished("c1", "Fri", isError = false),
                AgentStreamEvent.TurnStarted("a2"),
                AgentStreamEvent.Error("upstream closed"),
            )
        }
        store(
            ClientMessage("q1", "user", "What day is it?"),
            reply("a1", "q1")
                .copy(
                    thinking = "Need the date\n\nCheck the clock",
                    toolCalls = listOf(ClientToolCall("c1", "bash", """{"cmd":"date"}""")),
                ),
            toolOutput("t1", "a1", "c1", "Fri"),
            reply("a2", "t1").copy(status = MessageStatus.Error, error = "upstream closed"),
        )
        showStage()

        send("What day is it?")

        compose.onAllNodesWithText("upstream closed").assertCountEquals(1)
        compose.onNodeWithText("Check the clock").assertDoesNotExist()
        compose.onNodeWithText("Thought · ran {\"cmd\":\"date\"}").performClick()
        compose.onNodeWithText("2 steps").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Need the date").performClick()
        compose.onNodeWithText("Step details").assertIsDisplayed()
        compose.onNodeWithText("Check the clock").assertIsDisplayed()

        Espresso.pressBack()
        compose.onNodeWithText("Step details").assertDoesNotExist()
        compose.onNodeWithText("{\"cmd\":\"date\"}").performClick()
        compose.onNodeWithText("Step details").assertIsDisplayed()
        compose.onAllNodesWithText("{\"cmd\":\"date\"}").assertCountEquals(2)
        compose.onNodeWithText("Fri").assertIsDisplayed()
    }

    @Test
    fun aSettledReplyCopiesItsTextAndNamesItsModel() {
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.TextDelta("Hello there"),
                AgentStreamEvent.Done(),
            )
        }
        store(ClientMessage("q1", "user", "Hi"), reply("a1", "q1", "Hello there"))
        showStage()

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
    fun aCodeBlockInAReplyOpensInASheetTitledWithItsLanguage() {
        val answer = "Run:\n\n```kotlin\nval x = 1\n```\n\nThen:\n\n```\nls -la\n```\n\nDone."
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.TextDelta(answer),
                AgentStreamEvent.Done(),
            )
        }
        store(ClientMessage("q1", "user", "How?"), reply("a1", "q1", answer))
        showStage()

        send("How?")
        waitForText("Done.")

        compose.onAllNodesWithText("Open")[0].performScrollTo().performClick()
        compose.onAllNodesWithText("kotlin").assertCountEquals(2)
        compose.onAllNodesWithText("val x = 1", substring = true).assertCountEquals(2)
        Espresso.pressBack()
        compose.onAllNodesWithText("val x = 1", substring = true).assertCountEquals(1)

        compose.onAllNodesWithText("Open")[1].performScrollTo().performClick()
        compose.onNodeWithText("Code").assertIsDisplayed()
        compose.onAllNodesWithText("ls -la", substring = true).assertCountEquals(2)
    }

    @Test
    fun aStepThatStreamsNothingYetShowsThatTheModelThinks() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
        showStage()

        send("Hello")
        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.ToolCallStarted("c1", "bash", "{}"))
        compose.onNodeWithText("ran {}").assertIsDisplayed()

        events.trySend(AgentStreamEvent.TurnStarted("a2"))
        compose.onNodeWithText("Thinking").assertIsDisplayed()
        events.trySend(AgentStreamEvent.Aborted())
        compose.onNodeWithText("Generation stopped.").assertIsDisplayed()
    }

    @Test
    fun aFailureOutsideATurnShowsAsASnackbarThatGoesAway() {
        client.onListProviders = { throw ServiceException(ServiceFailure.Network) }
        val viewModel = showStage()

        compose.onNodeWithText(unreachable).assertIsDisplayed()
        compose.onNodeWithText("Retry", substring = true).assertDoesNotExist()
        compose.mainClock.advanceTimeBy(5_000)

        compose.onNodeWithText(unreachable).assertDoesNotExist()
        assertNull(viewModel.error)
    }

    @Test
    fun aFailedTurnTakesOverTheComposerUntilItIsRetried() {
        client.onSendMessage = { _, _, _, _, _ ->
            if (client.calls.count { it.name == "sendMessage" } == 1) {
                flow { throw ServiceException(ServiceFailure.Network) }
            } else {
                flowOf(
                    AgentStreamEvent.Started("q2"),
                    AgentStreamEvent.TurnStarted("a2"),
                    AgentStreamEvent.TextDelta("Hi"),
                    AgentStreamEvent.Done(),
                )
            }
        }
        store(ClientMessage("q2", "user", "Hello"), reply("a2", "q2", "Hi"))
        showStage()

        send("Hello")
        compose.onAllNodesWithText(unreachable).assertCountEquals(1)
        compose.onNodeWithText("Retry with gpt-4o").performClick()

        waitForText("Hi")
        compose.onNodeWithText("Hi").assertIsDisplayed()
        compose.onNodeWithText("Retry with gpt-4o").assertDoesNotExist()
        compose.onAllNodesWithText(unreachable).assertCountEquals(0)
        assertEquals(Call("sendMessage", "session-1", "Hello", "openai", "gpt-4o", ""), lastSend())
    }

    @Test
    fun theDockSwitchesTheModelToRetryWithAndANewTurnClosesIt() {
        client.onListProviders = { listOf(sampleProvider("openai", "gpt-4o", "gpt-4o-mini")) }
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q1"), AgentStreamEvent.Error("upstream closed"))
        }
        val question = ClientMessage("q1", "user", "Hello")
        val failed = reply("a1", "q1").copy(status = MessageStatus.Error, error = "upstream closed")
        store(question, failed)
        showStage()

        send("Hello")
        compose.onNodeWithText("Switch model").performClick()
        compose.onNodeWithText("gpt-4o-mini").performClick()
        compose.onNodeWithText("Retry with gpt-4o-mini").assertIsDisplayed()

        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q2"), AgentStreamEvent.Done())
        }
        store(
            question,
            failed,
            ClientMessage("q2", "user", "Next", parentId = "a1"),
            reply("a2", "q2"),
        )
        send("Next")

        compose.onNodeWithText("Retry with gpt-4o-mini").assertDoesNotExist()
        assertEquals(
            Call("sendMessage", "session-1", "Next", "openai", "gpt-4o-mini", null),
            lastSend(),
        )
    }

    @Test
    fun aRunningTurnShowsItsStepAndTimeAtopTheComposerAndStopsFromThere() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
        showStage()

        send("Hello")
        compose.onNodeWithText("Thinking…").assertIsDisplayed()
        compose.onNode(hasSetTextAction()).performTextInput("More")
        compose.onNodeWithContentDescription("Send").assertIsNotEnabled()
        val started = elapsedSeconds()
        compose.mainClock.advanceTimeBy(2_000)
        assertTrue(elapsedSeconds() - started in 1.7..2.0)

        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.TurnStarted("a1"))
        events.trySend(AgentStreamEvent.ToolCallStarted("c1", "bash", "{}"))
        compose.onNodeWithText("Running bash…").assertIsDisplayed()
        compose.onNodeWithText("Stop").performClick()
        compose.waitUntil { client.calls.any { it.name == "abortMessage" } }
        assertEquals(Call("abortMessage", "q1"), client.calls.last())

        store(
            ClientMessage("q1", "user", "Hello"),
            reply("a1", "q1")
                .copy(
                    status = MessageStatus.Aborted,
                    toolCalls = listOf(ClientToolCall("c1", "bash", "{}")),
                ),
        )
        events.trySend(AgentStreamEvent.Aborted())
        events.close()
        compose.onNodeWithText("Generation stopped.").assertIsDisplayed()
        compose.onNodeWithText("Stop").assertDoesNotExist()
    }

    @Test
    fun aBrokenStreamShowsAReconnectHintUntilItResumes() {
        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                emit(AgentStreamEvent.TurnStarted("a1"))
                emit(AgentStreamEvent.TextDelta("Hi"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        val resumed = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onResumeStream = { _, _ -> resumed.consumeAsFlow() }
        showStage()
        val hint = "Connection interrupted, resuming from event 3…"

        send("Hello")
        compose.onAllNodesWithText(hint).assertCountEquals(2)
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(600))
        resumed.trySend(AgentStreamEvent.TextDelta(" there"))

        compose.waitUntil { compose.onAllNodesWithText(hint).fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithText("Hi there").assertIsDisplayed()
    }

    @Test
    fun aFollowedTurnCountsItsTimeFromWhenTheServiceRecordedItsQuestion() {
        val asked = Clock.System.now().toEpochMilliseconds() - 90_000
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("q1", "user").copy(createdAt = asked),
                    ClientMessage(
                        "a1",
                        "assistant",
                        "",
                        status = MessageStatus.Streaming,
                        parentId = "q1",
                    ),
                ),
                leafId = "a1",
            )
        }
        client.onResumeStream = { _, _ -> flow { awaitCancellation() } }
        val viewModel = showStage()

        compose.runOnIdle { viewModel.selectSession(sampleSession("trip", "Trip")) }

        compose
            .onNode(
                SemanticsMatcher("counts from the question") { node ->
                    node.config
                        .getOrElse(SemanticsProperties.Text) { emptyList() }
                        .any {
                            it.text.matches(Regex("""1m 3\ds"""))
                        }
                }
            )
            .assertIsDisplayed()
    }

    @Test
    fun theModelPickerSwitchesModelsAndLeadsToTheProviders() {
        client.onListProviders = {
            listOf(
                sampleProvider("openai", "gpt-4o", "gpt-4o-mini"),
                sampleProvider("off", "m1", enabled = false),
            )
        }
        showStage()

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
    fun aThinkingStepCountsItsTimeInTheTimeline() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
        showStage()
        val start = System.currentTimeMillis()

        send("Plan a trip")
        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.TurnStarted("a1"))
        events.trySend(AgentStreamEvent.ThinkingDelta("Check the weather", start))
        compose.onAllNodesWithText("Thinking…")[0].performClick()
        events.trySend(AgentStreamEvent.ThinkingDelta(" first", start + 500))
        waitForText("Check the weather first")

        events.trySend(AgentStreamEvent.TextDelta("Pack light", start + 1_500))
        compose.onNodeWithText("Thought 1.5s").assertIsDisplayed()
        events.trySend(AgentStreamEvent.Done(start + 2_000))
        compose.onNodeWithText("Pack light").assertIsDisplayed()
        compose.onNodeWithText("Check the weather first").performClick()
        compose.onNodeWithText("Step details").assertIsDisplayed()
    }

    @Test
    fun toolStepsShowFailuresWaitingResultsAndLongArgumentsInTheirDetails() {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
        showStage()
        val start = System.currentTimeMillis() - 5_000
        val arguments = (1..40).joinToString(",", "{", "}") { "\"key$it\":$it" }

        send("Read the files")
        events.trySend(AgentStreamEvent.Started("q1"))
        events.trySend(AgentStreamEvent.TurnStarted("a1"))
        events.trySend(AgentStreamEvent.ToolCallStarted("c1", "bash", "", start))
        events.trySend(AgentStreamEvent.ToolCallFinished("c1", "denied", true, start + 1_200))
        events.trySend(AgentStreamEvent.ToolCallStarted("c2", "read", arguments, start + 1_300))
        compose.onNodeWithText("ran bash · read").performClick()
        compose.onNodeWithText("Failed").performClick()
        compose.onNodeWithText("denied").assertIsDisplayed()

        Espresso.pressBack()
        compose.onNodeWithText(arguments).performClick()
        compose.onNodeWithText("Waiting for result…").assertIsDisplayed()
        compose.onAllNodesWithText(arguments).assertCountEquals(2)

        Espresso.pressBack()
        events.trySend(AgentStreamEvent.ToolCallFinished("c2", "ok", false, start + 2_000))
        events.trySend(AgentStreamEvent.Done(start + 2_100))
        compose.onNodeWithText("Failed · fixed later").assertExists()
    }

    @Test
    fun fileAndWebStepsShowHighlightedCodeAndOpenableResults() {
        val results =
            """{"provider":"exa","note":"Top hits","results":[""" +
                """{"title":"Rust","url":"https://rust-lang.org","snippet":"Systems language"}]}"""
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ToolCallStarted("c1", "read_file", """{"path":"src/main.rs"}"""),
                AgentStreamEvent.ToolCallFinished("c1", "fn main() {}", isError = false),
                AgentStreamEvent.ToolCallStarted("c2", "web_search", """{"query":"rust"}"""),
                AgentStreamEvent.ToolCallFinished("c2", results, isError = false),
                AgentStreamEvent.TurnStarted("a2"),
                AgentStreamEvent.TextDelta("Rust it is"),
                AgentStreamEvent.Done(),
            )
        }
        store(
            ClientMessage("q1", "user", "Which language?"),
            reply("a1", "q1")
                .copy(
                    toolCalls =
                        listOf(
                            ClientToolCall("c1", "read_file", """{"path":"src/main.rs"}"""),
                            ClientToolCall("c2", "web_search", """{"query":"rust"}"""),
                        )
                ),
            toolOutput("t1", "a1", "c1", "fn main() {}"),
            toolOutput("t2", "t1", "c2", results),
            reply("a2", "t2", "Rust it is"),
        )
        showStage()

        send("Which language?")
        compose.onNodeWithText("read main.rs · searched the web").performClick()
        compose.onNodeWithText("exa").assertIsDisplayed()
        compose.onNodeWithText("src/main.rs").performClick()
        compose.onNodeWithText("fn main() {}").assertIsDisplayed()
        compose.onNodeWithContentDescription("Copy code").assertIsDisplayed()

        Espresso.pressBack()
        compose.onNodeWithText("rust").performClick()
        compose.onNodeWithText("Top hits").assertIsDisplayed()
        compose.onNodeWithText("Systems language").assertIsDisplayed()
        compose.onNodeWithText("Rust").performClick()
        val opened = shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity
        assertEquals("https://rust-lang.org", opened.data.toString())
    }

    @Test
    fun aReplyOfUnnamedToolsSummarizesItsStepCount() {
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ToolCallStarted("c1", "", "{}"),
                AgentStreamEvent.ToolCallFinished("c1", "ok", isError = false),
                AgentStreamEvent.Done(),
            )
        }
        store(
            ClientMessage("q1", "user", "Go"),
            reply("a1", "q1").copy(toolCalls = listOf(ClientToolCall("c1", "", "{}"))),
            toolOutput("t1", "a1", "c1", "ok"),
        )
        showStage()

        send("Go")
        compose
            .onNodeWithText("1 step")
            .assert(
                SemanticsMatcher.expectValue(
                    SemanticsProperties.Text,
                    listOf(AnnotatedString("1 step"), AnnotatedString("1 step")),
                )
            )
    }

    private fun forkedTree(streaming: Boolean = false) =
        ClientMessageTree(
            listOf(
                ClientMessage("q1", "user", "Trip plan"),
                ClientMessage("a1", "assistant", "Two routes", parentId = "q1"),
                ClientMessage("q2", "user", "Coast road?", parentId = "a1"),
                ClientMessage("a2", "assistant", "Scenic", parentId = "q2", label = "Keep"),
                ClientMessage("q3", "user", "Mountain pass?", parentId = "a1"),
                ClientMessage(
                    "a3",
                    "assistant",
                    "Faster",
                    status = if (streaming) MessageStatus.Streaming else MessageStatus.Done,
                    parentId = "q3",
                ),
            ),
            leafId = "a3",
        )

    private fun showForkedSession(tree: ClientMessageTree = forkedTree()): AgentViewModel {
        client.onListMessages = { tree }
        val viewModel = showStage()
        compose.onNodeWithText("Session tree").assertDoesNotExist()
        compose.runOnIdle { viewModel.selectSession(sampleSession("trip", "Trip")) }
        compose.waitUntil { viewModel.messages.isNotEmpty() }
        return viewModel
    }

    private fun openTree() {
        compose.onNodeWithText("Session tree").performClick()
        compose.onNodeWithText("Tree · 2 paths").assertIsDisplayed()
    }

    private fun searchField() =
        compose.onNode(hasSetTextAction() and hasAnySibling(hasText("Search tree…")))

    private fun scrollTreeTo(text: String) {
        compose
            .onNode(hasScrollToNodeAction() and hasAnyDescendant(hasLongClickAction()))
            .performScrollToNode(hasText(text))
    }

    private fun hasLongClickAction() = SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick)

    @Test
    @Config(qualifiers = TALL_SCREEN)
    fun theTreeSheetFiltersAndSearchesItsRows() {
        showForkedSession()

        openTree()
        val hint = "Tap a question to branch · tap a reply to switch path · long-press to label"
        compose.onNodeWithText(hint).assertIsDisplayed()
        compose.onNodeWithText("Coast road?").assertIsDisplayed()
        compose.onNodeWithText("Keep").assertIsDisplayed()

        compose.onNodeWithText("Questions").performClick()
        compose.onNodeWithText("Coast road?").assertIsDisplayed()
        compose.onNodeWithText("Scenic").assertDoesNotExist()

        compose.onNodeWithText("Labeled").performClick()
        compose.onNodeWithText("Coast road?").assertDoesNotExist()
        compose.onNodeWithText("Scenic").assertIsDisplayed()

        compose.onNodeWithText("All").performClick()
        searchField().performTextInput("scenic")
        compose.onNodeWithText("Coast road?").assertDoesNotExist()
        compose.onNodeWithText("Scenic").assertIsDisplayed()

        compose.onNode(hasSetTextAction() and hasText("scenic")).performTextInput("zzz")
        compose.onNodeWithText("No matching messages.").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = TALL_SCREEN)
    fun tappingAReplyRowShowsItsPathAndClosesTheTree() {
        showForkedSession()

        openTree()
        compose.onNodeWithText("Scenic").performClick()

        waitForText("Coast road?")
        compose.onNodeWithText("Tree · 2 paths").assertDoesNotExist()
        compose.onNodeWithText("Mountain pass?").assertDoesNotExist()
        assertEquals(Call("setSessionLeaf", "trip", "a2"), client.calls.last())
    }

    @Test
    @Config(qualifiers = TALL_SCREEN)
    fun tappingAQuestionRowRewindsUntilTheBannerRestoresThePathAndDraft() {
        val viewModel = showForkedSession()
        compose.onNode(hasSetTextAction()).performTextInput("my note")

        openTree()
        compose.onNodeWithText("Coast road?").performClick()

        compose.onNodeWithText("Tree · 2 paths").assertDoesNotExist()
        val banner = "Rewound before question · sending starts a new branch (original kept)"
        compose.onNodeWithText(banner).assertIsDisplayed()
        compose.onNodeWithText("Mountain pass?").assertDoesNotExist()
        assertEquals("Coast road?", viewModel.input)

        compose.onNodeWithText("Restore branch").performClick()
        compose.onNodeWithText(banner).assertDoesNotExist()
        compose.onNodeWithText("Mountain pass?").assertIsDisplayed()
        assertEquals("my note", viewModel.input)
        assertTrue(client.calls.none { it.name == "setSessionLeaf" })
    }

    @Test
    fun aLongPressEditsTheRowLabel() {
        showForkedSession()

        openTree()
        scrollTreeTo("Coast road?")
        compose.onNodeWithText("Coast road?").performTouchInput { longClick() }
        compose.onNodeWithText("Label").assertIsDisplayed()
        compose
            .onNode(hasSetTextAction() and hasAnySibling(hasText("Label…")))
            .performTextInput("Plan B")
        compose.onNodeWithText("Save").performClick()

        compose.onNodeWithText("Plan B").assertIsDisplayed()
        assertEquals(Call("setMessageLabel", "trip", "q2", "Plan B"), client.calls.last())

        compose.onNodeWithText("Plan B").performTouchInput { longClick() }
        compose.onNodeWithText("Edit label").assertIsDisplayed()
        compose.onNode(hasSetTextAction() and hasText("Plan B")).performTextClearance()
        compose.onNodeWithText("Save").performClick()

        compose.onNodeWithText("Plan B").assertDoesNotExist()
        assertEquals(Call("setMessageLabel", "trip", "q2", null), client.calls.last())

        scrollTreeTo("Scenic")
        compose.onNodeWithText("Scenic").performTouchInput { longClick() }
        compose.onNodeWithText("Edit label").assertIsDisplayed()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithText("Edit label").assertDoesNotExist()
        compose.onNodeWithText("Keep").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = TALL_SCREEN)
    fun whileATurnRunsTappingRowsLeavesThePathAlone() {
        client.onResumeStream = { _, _ -> flow { awaitCancellation() } }
        showForkedSession(forkedTree(streaming = true))

        openTree()
        compose.onNodeWithText("Coast road?").performClick()
        compose.onNodeWithText("Scenic").performClick()

        compose.onNodeWithText("Tree · 2 paths").assertIsDisplayed()
        compose.onNodeWithText("Restore branch").assertDoesNotExist()
        assertTrue(client.calls.none { it.name == "setSessionLeaf" })
    }
}
