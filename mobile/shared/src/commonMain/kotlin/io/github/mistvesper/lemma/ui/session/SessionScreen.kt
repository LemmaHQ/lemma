package io.github.mistvesper.lemma.ui.session

import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.navigationevent.NavigationEventInfo
import androidx.navigationevent.compose.NavigationBackHandler
import androidx.navigationevent.compose.rememberNavigationEventState
import kotlinx.coroutines.launch

/**
 * The session list of [sessions] in a drawer beside [content], which shows the open session and
 * receives the action that opens the drawer; [sessions] opens the session a row selects. A back
 * press closes the open drawer before it leaves the screen.
 */
@Composable
internal fun SessionScreen(
    sessions: SessionListViewModel,
    openSessionId: String?,
    onNewSession: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable (openDrawer: () -> Unit) -> Unit,
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    LaunchedEffect(drawerState, sessions) {
        snapshotFlow { drawerState.currentValue }
            .collect { value ->
                if (value == DrawerValue.Open) {
                    sessions.refreshSessions()
                }
            }
    }

    NavigationBackHandler(
        state = rememberNavigationEventState(NavigationEventInfo.None),
        isBackEnabled = drawerState.isOpen,
        onBackCompleted = { scope.launch { drawerState.close() } },
    )

    ModalNavigationDrawer(
        drawerState = drawerState,
        modifier = modifier,
        drawerContent = {
            SessionDrawer(
                sessions = sessions.sessions,
                currentSessionId = openSessionId,
                markerOf = sessions::markerOf,
                onNewSession = {
                    scope.launch { drawerState.close() }
                    onNewSession()
                },
                onSelectSession = { session ->
                    scope.launch { drawerState.close() }
                    sessions.selectSession(session)
                },
                onRenameSession = sessions::renameSession,
                onDeleteSession = sessions::deleteSession,
                onOpenSettings = {
                    scope.launch { drawerState.close() }
                    onOpenSettings()
                },
            )
        },
    ) {
        content { scope.launch { drawerState.open() } }
    }
}
