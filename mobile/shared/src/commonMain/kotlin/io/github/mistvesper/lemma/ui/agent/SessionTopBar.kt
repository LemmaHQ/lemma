package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaIconButton
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_menu
import lemma.mobile.shared.generated.resources.session_show_list
import lemma.mobile.shared.generated.resources.session_tree_title
import org.jetbrains.compose.resources.stringResource

/**
 * The session's [title] between the button that opens the session list and, when [onOpenTree] is
 * set, the pill that opens the session tree.
 */
@Composable
internal fun SessionTopBar(
    title: String,
    onOpenDrawer: () -> Unit,
    onOpenTree: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().height(48.dp).padding(end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LemmaIconButton(
            icon = Res.drawable.icon_menu,
            contentDescription = stringResource(Res.string.session_show_list),
            onClick = onOpenDrawer,
        )
        Text(
            text = title,
            style = LemmaTheme.typography.title,
            color = LemmaTheme.colors.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        onOpenTree?.let {
            Text(
                text = stringResource(Res.string.session_tree_title),
                style = LemmaTheme.typography.small,
                color = LemmaTheme.colors.mutedForeground,
                maxLines = 1,
                modifier =
                    Modifier.minimumInteractiveComponentSize()
                        .clip(LemmaTheme.shapes.sm)
                        .clickable(role = Role.Button, onClick = it)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
    }
}
