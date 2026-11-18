package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ClientSession
import io.github.mistvesper.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_reconnecting
import lemma.mobile.shared.generated.resources.common_app_name
import lemma.mobile.shared.generated.resources.errors_agent_failed
import lemma.mobile.shared.generated.resources.session_retry_with_model
import lemma.mobile.shared.generated.resources.session_rewind_banner
import lemma.mobile.shared.generated.resources.session_rewind_restore
import lemma.mobile.shared.generated.resources.session_select_model
import lemma.mobile.shared.generated.resources.session_switch_model_retry
import lemma.mobile.shared.generated.resources.sidebar_new_session
import org.jetbrains.compose.resources.stringResource

/**
 * The open session under its top bar, whose pill opens the session tree: the messages, a hint while
 * a broken stream resumes, and the composer, whose footer opens the model picker. The composer's
 * top shows the running turn's status and a rewind with its restore action, or else the failed turn
 * with its recovery actions; failures outside a turn show as a snackbar. Tapping a reply's step
 * opens its details, and opening a code block in a reply shows the code in a sheet. In the tree,
 * tapping a reply shows its path and tapping a question rewinds to ask it again; one sheet shows at
 * a time. [sessionTitle] names the open session, and [createSession] opens a new one for its first
 * turn.
 */
@Composable
internal fun SessionStage(
    viewModel: AgentViewModel,
    sessionTitle: String?,
    createSession: suspend () -> ClientSession,
    onOpenDrawer: () -> Unit,
    onManageProviders: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val composerFocus = remember { FocusRequester() }
    val snackbar = remember { SnackbarHostState() }
    var showModelPicker by rememberSaveable { mutableStateOf(false) }
    var openStepId by rememberSaveable { mutableStateOf<String?>(null) }
    var showTree by rememberSaveable { mutableStateOf(false) }
    var openCode by rememberSaveable { mutableStateOf<String?>(null) }
    var openCodeLanguage by rememberSaveable { mutableStateOf<String?>(null) }
    val openModelPicker = {
        openStepId = null
        showModelPicker = true
    }
    val openTree = { showTree = true }
    val error = viewModel.error?.text()

    SideEffect(Unit) { viewModel.loadProviders() }
    LaunchedEffect(error) {
        if (error != null) {
            snackbar.showSnackbar(error)
            viewModel.dismissError()
        }
    }

    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        SessionTopBar(
            title =
                if (viewModel.openSession == null) {
                    stringResource(Res.string.common_app_name)
                } else {
                    sessionTitle?.takeIf { it.isNotBlank() }
                        ?: stringResource(Res.string.sidebar_new_session)
                },
            onOpenDrawer = onOpenDrawer,
            onOpenTree = openTree.takeIf { viewModel.openSession != null },
        )
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.border))
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            key(viewModel.openSession?.id) {
                MessageList(
                    messages = viewModel.messages,
                    providers = viewModel.providers,
                    canRegenerate = !viewModel.turnRunning,
                    onRegenerate = viewModel::regenerate,
                    onOpenStep = { step ->
                        showModelPicker = false
                        openStepId = step.id
                    },
                    onOpenCode = { code, language ->
                        openCodeLanguage = language
                        openCode = code
                    },
                    modifier = Modifier.fillMaxSize(),
                )
            }
            SnackbarHost(hostState = snackbar, modifier = Modifier.align(Alignment.BottomCenter)) {
                Snackbar(
                    snackbarData = it,
                    shape = LemmaTheme.shapes.md,
                    containerColor = LemmaTheme.colors.popover,
                    contentColor = LemmaTheme.colors.destructive,
                )
            }
        }
        viewModel.reconnectOffset?.let { offset ->
            Text(
                text = stringResource(Res.string.agent_reconnecting, offset),
                style = LemmaTheme.typography.small,
                color = LemmaTheme.colors.warning,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        MessageComposer(
            value = viewModel.input,
            onValueChange = viewModel::changeInput,
            turnRunning = viewModel.turnRunning,
            onSend = { viewModel.send(createSession) },
            modelLabel =
                if (viewModel.providers.any { it.enabled }) {
                    viewModel.selection?.model ?: stringResource(Res.string.session_select_model)
                } else {
                    null
                },
            onOpenModelPicker = openModelPicker,
            focusRequester = composerFocus,
        ) {
            ComposerNotice(
                rewinding = viewModel.rewinding,
                failure = viewModel.turnFailure,
                model = viewModel.selection?.model,
                onRestore = viewModel::cancelRewind,
                onSwitchModel = openModelPicker,
                onRetry = viewModel::retry,
            )
            viewModel.turnStartedAt?.let { startedAt ->
                val offset = viewModel.reconnectOffset
                RunningStatusRow(
                    step = runningStep(viewModel.messages.lastOrNull(), offset).text(),
                    startedAt = startedAt,
                    warn = offset != null,
                    onStop = viewModel::stop,
                )
            }
        }
    }

    if (showModelPicker) {
        val closePicker = { showModelPicker = false }
        ModelPickerSheet(
            providers = viewModel.providers,
            selection = viewModel.selection,
            onSelect = { selection ->
                viewModel.selectModel(selection)
                closePicker()
            },
            onManageProviders = {
                closePicker()
                onManageProviders()
            },
            onDismiss = closePicker,
        )
    }
    val messages = viewModel.messages
    val openStep = openStepId?.let { id -> remember(messages, id) { messages.findStep(id) } }
    openStep?.let { StepDetailSheet(step = it, onDismiss = { openStepId = null }) }
    openCode?.let {
        CodeSheet(code = it, language = openCodeLanguage, onDismiss = { openCode = null })
    }
    viewModel.sessionTree
        ?.takeIf { showTree }
        ?.let { tree ->
            SessionTreeSheet(
                tree = tree,
                navigable = !viewModel.turnRunning,
                onSelect = { row ->
                    showTree = false
                    viewModel.openTreeRow(row, composerFocus)
                },
                onSaveLabel = viewModel::labelMessage,
                onDismiss = { showTree = false },
            )
        }
}

/**
 * The notice atop the composer: a rewind with its restore action, or else the failed turn [failure]
 * with actions that open the model picker and retry with [model].
 */
@Composable
private fun ComposerNotice(
    rewinding: Boolean,
    failure: UiMessage?,
    model: String?,
    onRestore: () -> Unit,
    onSwitchModel: () -> Unit,
    onRetry: () -> Unit,
) {
    if (rewinding) {
        ComposerDock(
            message = stringResource(Res.string.session_rewind_banner),
            color = LemmaTheme.colors.mutedForeground,
        ) {
            ComposerAction(
                text = stringResource(Res.string.session_rewind_restore),
                primary = false,
                onClick = onRestore,
            )
        }
    } else if (failure != null) {
        ComposerDock(
            message = failure.error?.text() ?: stringResource(Res.string.errors_agent_failed),
            color = LemmaTheme.colors.destructive,
        ) {
            ComposerAction(
                text = stringResource(Res.string.session_switch_model_retry),
                primary = false,
                onClick = onSwitchModel,
            )
            ComposerAction(
                text =
                    stringResource(
                        Res.string.session_retry_with_model,
                        model ?: failure.model.orEmpty(),
                    ),
                primary = true,
                onClick = onRetry,
            )
        }
    }
}

/** Rewinds to the question [row] and focuses the composer, or shows the path to the reply [row]. */
private fun AgentViewModel.openTreeRow(row: TreeRow, composerFocus: FocusRequester) {
    if (row.question) {
        rewind(row.id)
        composerFocus.requestFocus()
    } else {
        switchLeaf(row.id)
    }
}
