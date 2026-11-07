package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_app_name
import lemma.mobile.shared.generated.resources.session_select_model
import lemma.mobile.shared.generated.resources.session_untitled
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun SessionScreen(
    viewModel: SessionViewModel,
    username: String?,
    onManageProviders: () -> Unit,
    onOpenSettings: () -> Unit,
    onLoadAccount: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val composerFocus = remember { FocusRequester() }
    var showModelPicker by rememberSaveable { mutableStateOf(false) }
    val loadAccount by rememberUpdatedState(onLoadAccount)

    SideEffect(Unit) { viewModel.loadProviders() }

    LaunchedEffect(drawerState, viewModel) {
        snapshotFlow { drawerState.currentValue }
            .collect { value ->
                if (value == DrawerValue.Open) {
                    loadAccount()
                    viewModel.refreshSessions()
                }
            }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            SessionDrawer(
                sessions = viewModel.sessions,
                currentSessionId = viewModel.openSession?.id,
                username = username,
                onNewSession = {
                    scope.launch { drawerState.close() }
                    viewModel.newSession()
                },
                onSelectSession = { session ->
                    scope.launch { drawerState.close() }
                    viewModel.selectSession(session)
                },
                onRenameSession = viewModel::renameSession,
                onDeleteSession = viewModel::deleteSession,
                onOpenSettings = {
                    scope.launch { drawerState.close() }
                    onOpenSettings()
                },
                onSignOut = onSignOut,
            )
        },
    ) {
        Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
            SessionTopBar(
                title =
                    if (viewModel.openSession == null) {
                        stringResource(Res.string.common_app_name)
                    } else {
                        viewModel.currentSession?.title?.takeIf { it.isNotBlank() }
                            ?: stringResource(Res.string.session_untitled)
                    },
                modelLabel =
                    if (viewModel.providers.any { it.enabled }) {
                        viewModel.selection?.model
                            ?: stringResource(Res.string.session_select_model)
                    } else {
                        null
                    },
                onOpenDrawer = { scope.launch { drawerState.open() } },
                onOpenModelPicker = { showModelPicker = true },
            )
            Box(
                modifier =
                    Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.separator)
            )
            key(viewModel.openSession?.id) {
                MessageList(
                    messages = viewModel.messages,
                    providers = viewModel.providers,
                    canRegenerate = !viewModel.turnRunning,
                    onRegenerate = viewModel::regenerate,
                    onPickSuggestion = { text ->
                        viewModel.changeInput(text)
                        composerFocus.requestFocus()
                    },
                    onReachOldest = viewModel::loadOlderMessages,
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                )
            }
            viewModel.error?.let { error ->
                ErrorBanner(
                    message = error.text(),
                    showRetry = viewModel.retryText != null && !viewModel.turnRunning,
                    onRetry = viewModel::retry,
                    onDismiss = viewModel::dismissError,
                )
            }
            MessageComposer(
                value = viewModel.input,
                onValueChange = viewModel::changeInput,
                isStreaming = viewModel.stoppable,
                onStop = viewModel::stop,
                onSend = viewModel::send,
                focusRequester = composerFocus,
            )
        }
    }

    if (showModelPicker) {
        val closePicker = { showModelPicker = false }
        ModelPickerDialog(
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
}
