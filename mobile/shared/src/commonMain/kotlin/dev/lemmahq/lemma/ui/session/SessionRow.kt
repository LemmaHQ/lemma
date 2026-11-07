package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenu
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenuItem
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_ellipsis
import lemma.mobile.shared.generated.resources.icon_pencil
import lemma.mobile.shared.generated.resources.icon_trash_2
import lemma.mobile.shared.generated.resources.session_actions
import lemma.mobile.shared.generated.resources.session_delete
import lemma.mobile.shared.generated.resources.session_rename
import lemma.mobile.shared.generated.resources.session_untitled
import org.jetbrains.compose.resources.stringResource

/** A drawer row opening [session]; its actions menu renames or deletes it. */
@Composable
internal fun SessionRow(
    session: ClientSession,
    selected: Boolean,
    onSelect: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .clip(LemmaTheme.shapes.medium)
                .background(if (selected) LemmaTheme.colors.fill2 else LemmaTheme.colors.fill1)
                .clickable(onClick = onSelect)
                .padding(start = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = session.title.ifBlank { stringResource(Res.string.session_untitled) },
            style = LemmaTheme.typography.bodyMedium,
            color =
                if (selected) LemmaTheme.colors.textPrimary else LemmaTheme.colors.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Box {
            LemmaIconButton(
                icon = Res.drawable.icon_ellipsis,
                contentDescription = stringResource(Res.string.session_actions),
                onClick = { menuExpanded = true },
                tint = LemmaTheme.colors.textTertiary,
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
