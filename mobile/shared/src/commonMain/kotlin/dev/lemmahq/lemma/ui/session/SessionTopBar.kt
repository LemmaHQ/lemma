package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
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
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_menu
import lemma.mobile.shared.generated.resources.session_select_model
import lemma.mobile.shared.generated.resources.session_show_list
import org.jetbrains.compose.resources.stringResource

/** The session's [title] beside the button that opens the session list, and the model chip. */
@Composable
internal fun SessionTopBar(
    title: String,
    modelLabel: String?,
    onOpenDrawer: () -> Unit,
    onOpenModelPicker: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = 4.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LemmaIconButton(
            icon = Res.drawable.icon_menu,
            contentDescription = stringResource(Res.string.session_show_list),
            onClick = onOpenDrawer,
        )
        Text(
            text = title,
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(start = 4.dp).semantics { heading() },
        )
        if (modelLabel != null) {
            Box(
                modifier =
                    Modifier.padding(start = 8.dp)
                        .minimumInteractiveComponentSize()
                        .widthIn(max = 160.dp)
                        .heightIn(min = 32.dp)
                        .clip(LemmaTheme.shapes.full)
                        .background(LemmaTheme.colors.fill2)
                        .clickable(
                            role = Role.Button,
                            onClickLabel = stringResource(Res.string.session_select_model),
                            onClick = onOpenModelPicker,
                        )
                        .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = modelLabel,
                    style = LemmaTheme.typography.labelSmall,
                    color = LemmaTheme.colors.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
