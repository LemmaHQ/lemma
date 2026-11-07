package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaConfirmDialog
import kotlin.time.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.todayIn
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_cancel
import lemma.mobile.shared.generated.resources.session_delete
import lemma.mobile.shared.generated.resources.session_delete_description
import lemma.mobile.shared.generated.resources.session_delete_title
import lemma.mobile.shared.generated.resources.session_earlier
import lemma.mobile.shared.generated.resources.session_last_7_days
import lemma.mobile.shared.generated.resources.session_list_title
import lemma.mobile.shared.generated.resources.session_new
import lemma.mobile.shared.generated.resources.session_today
import lemma.mobile.shared.generated.resources.session_yesterday
import org.jetbrains.compose.resources.stringResource

/**
 * The drawer listing [sessions] by recency, with the new session button and the account menu;
 * deleting a session asks for confirmation first.
 */
@Composable
internal fun SessionDrawer(
    sessions: List<ClientSession>,
    currentSessionId: String?,
    username: String?,
    onNewSession: () -> Unit,
    onSelectSession: (ClientSession) -> Unit,
    onRenameSession: (ClientSession, String) -> Unit,
    onDeleteSession: (ClientSession) -> Unit,
    onOpenSettings: () -> Unit,
    onSignOut: () -> Unit,
) {
    var renaming by remember { mutableStateOf<ClientSession?>(null) }
    var deleting by remember { mutableStateOf<ClientSession?>(null) }
    val groups =
        remember(sessions) {
            val timeZone = TimeZone.currentSystemDefault()
            groupSessions(sessions, Clock.System.todayIn(timeZone), timeZone)
        }
    ModalDrawerSheet(
        drawerContainerColor = LemmaTheme.colors.backgroundGroup,
        modifier = Modifier.width(280.dp),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                text = stringResource(Res.string.session_list_title),
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(16.dp))
            LemmaButton(
                text = stringResource(Res.string.session_new),
                onClick = onNewSession,
                modifier = Modifier.fillMaxWidth(),
                variant = LemmaButtonVariant.Primary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                for (group in groups) {
                    item(key = group.period.name) {
                        Text(
                            text = group.period.label(),
                            style = LemmaTheme.typography.labelSmall,
                            color = LemmaTheme.colors.textTertiary,
                            modifier = Modifier.padding(start = 12.dp, top = 12.dp, bottom = 4.dp),
                        )
                    }
                    items(group.sessions, key = { it.id }) { session ->
                        SessionRow(
                            session = session,
                            selected = session.id == currentSessionId,
                            onSelect = { onSelectSession(session) },
                            onRename = { renaming = session },
                            onDelete = { deleting = session },
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            AccountMenu(username = username, onOpenSettings = onOpenSettings, onSignOut = onSignOut)
        }
    }

    renaming?.let { session ->
        RenameSessionDialog(
            title = session.title,
            onSave = { title ->
                renaming = null
                onRenameSession(session, title)
            },
            onDismiss = { renaming = null },
        )
    }
    deleting?.let { session ->
        LemmaConfirmDialog(
            title = stringResource(Res.string.session_delete_title),
            description = stringResource(Res.string.session_delete_description),
            confirmLabel = stringResource(Res.string.session_delete),
            dismissLabel = stringResource(Res.string.common_cancel),
            onConfirm = {
                deleting = null
                onDeleteSession(session)
            },
            onDismiss = { deleting = null },
            destructive = true,
        )
    }
}

@Composable
private fun SessionPeriod.label(): String =
    stringResource(
        when (this) {
            SessionPeriod.Today -> Res.string.session_today
            SessionPeriod.Yesterday -> Res.string.session_yesterday
            SessionPeriod.Last7Days -> Res.string.session_last_7_days
            SessionPeriod.Earlier -> Res.string.session_earlier
        }
    )
