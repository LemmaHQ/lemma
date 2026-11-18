package io.github.mistvesper.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ClientSession
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaDropdownMenu
import io.github.mistvesper.lemma.ui.components.LemmaDropdownMenuItem
import io.github.mistvesper.lemma.ui.components.LemmaIconButton
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_ellipsis
import lemma.mobile.shared.generated.resources.icon_pencil
import lemma.mobile.shared.generated.resources.icon_trash_2
import lemma.mobile.shared.generated.resources.session_actions
import lemma.mobile.shared.generated.resources.session_delete
import lemma.mobile.shared.generated.resources.session_rename
import lemma.mobile.shared.generated.resources.sidebar_new_session
import org.jetbrains.compose.resources.stringResource

/**
 * A drawer row opening [session]; [marker] replaces its [time] when set, and its actions menu
 * renames or deletes it.
 */
@Composable
internal fun SessionRow(
    session: ClientSession,
    time: String,
    marker: SessionMarker?,
    selected: Boolean,
    onSelect: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .clip(LemmaTheme.shapes.md)
                .background(if (selected) LemmaTheme.colors.selected else Color.Transparent)
                .clickable(onClick = onSelect)
                .padding(start = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = session.title.ifBlank { stringResource(Res.string.sidebar_new_session) },
            style = LemmaTheme.typography.body,
            color =
                if (selected) LemmaTheme.colors.foreground else LemmaTheme.colors.mutedForeground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (marker != null) {
            SessionMarkerIcon(marker, modifier = Modifier.padding(start = 8.dp))
        } else if (time.isNotEmpty()) {
            Text(
                text = time,
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
                maxLines = 1,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
        Box {
            LemmaIconButton(
                icon = Res.drawable.icon_ellipsis,
                contentDescription = stringResource(Res.string.session_actions),
                onClick = { menuExpanded = true },
                tint = LemmaTheme.colors.subtleForeground,
            )
            LemmaDropdownMenu(expanded = menuExpanded, onDismiss = { menuExpanded = false }) {
                LemmaDropdownMenuItem(
                    title = stringResource(Res.string.session_rename),
                    icon = Res.drawable.icon_pencil,
                    onClick = {
                        menuExpanded = false
                        onRename()
                    },
                )
                LemmaDropdownMenuItem(
                    title = stringResource(Res.string.session_delete),
                    icon = Res.drawable.icon_trash_2,
                    destructive = true,
                    onClick = {
                        menuExpanded = false
                        onDelete()
                    },
                )
            }
        }
    }
}

/** The 6 dp [marker] with its description for screen readers. */
@Composable
private fun SessionMarkerIcon(marker: SessionMarker, modifier: Modifier = Modifier) {
    val description = stringResource(marker.description)
    val color = marker.color(LemmaTheme.colors)
    Box(
        modifier =
            modifier
                .semantics { contentDescription = description }
                .size(6.dp)
                .then(
                    if (marker.outlined) {
                        Modifier.border(1.dp, color, marker.shape)
                    } else {
                        Modifier.background(color, marker.shape)
                    }
                )
    )
}
