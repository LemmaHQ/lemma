package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenu
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenuItem
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.account_label
import lemma.mobile.shared.generated.resources.account_menu
import lemma.mobile.shared.generated.resources.account_sign_out
import lemma.mobile.shared.generated.resources.icon_chevron_down
import lemma.mobile.shared.generated.resources.icon_log_out
import lemma.mobile.shared.generated.resources.icon_settings
import lemma.mobile.shared.generated.resources.settings_app
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/** The account row at the bottom of the drawer; its menu opens the settings or signs out. */
@Composable
internal fun AccountMenu(
    username: String?,
    onOpenSettings: () -> Unit,
    onSignOut: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val accountName = username ?: stringResource(Res.string.account_label)
    Box {
        Row(
            modifier =
                Modifier.fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .clip(LemmaTheme.shapes.medium)
                    .clickable(onClickLabel = stringResource(Res.string.account_menu)) {
                        menuExpanded = true
                    }
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier.size(32.dp)
                        .clip(LemmaTheme.shapes.full)
                        .background(LemmaTheme.colors.fill3),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = username?.firstOrNull()?.uppercase().orEmpty(),
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textPrimary,
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = accountName,
                style = LemmaTheme.typography.bodyLarge,
                color = LemmaTheme.colors.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(
                painter = painterResource(Res.drawable.icon_chevron_down),
                contentDescription = null,
                tint = LemmaTheme.colors.textSecondary,
                modifier = Modifier.size(20.dp),
            )
        }
        LemmaDropdownMenu(
            expanded = menuExpanded,
            onDismiss = { menuExpanded = false },
            modifier = Modifier.width(224.dp),
        ) {
            Text(
                text = accountName,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
            HorizontalDivider(color = LemmaTheme.colors.separator)
            LemmaDropdownMenuItem(
                title = stringResource(Res.string.settings_app),
                icon = Res.drawable.icon_settings,
                onClick = {
                    menuExpanded = false
                    onOpenSettings()
                },
            )
            LemmaDropdownMenuItem(
                title = stringResource(Res.string.account_sign_out),
                icon = Res.drawable.icon_log_out,
                onClick = {
                    menuExpanded = false
                    onSignOut()
                },
            )
        }
    }
}
