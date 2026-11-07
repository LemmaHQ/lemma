package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_close
import lemma.mobile.shared.generated.resources.common_retry
import lemma.mobile.shared.generated.resources.icon_x
import org.jetbrains.compose.resources.stringResource

/** The last failure's [message], announced when it appears, with retry and dismiss actions. */
@Composable
internal fun ErrorBanner(
    message: String,
    showRetry: Boolean,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(LemmaTheme.colors.danger.copy(alpha = 0.12f))
                .semantics { liveRegion = LiveRegionMode.Polite }
                .padding(start = 16.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = message,
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.danger,
            modifier = Modifier.weight(1f).padding(vertical = 8.dp),
        )
        if (showRetry) {
            Text(
                text = stringResource(Res.string.common_retry),
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.primary,
                modifier =
                    Modifier.heightIn(min = 48.dp)
                        .clickable(role = Role.Button, onClick = onRetry)
                        .wrapContentHeight(Alignment.CenterVertically)
                        .padding(horizontal = 12.dp),
            )
        }
        LemmaIconButton(
            icon = Res.drawable.icon_x,
            contentDescription = stringResource(Res.string.common_close),
            onClick = onDismiss,
            tint = LemmaTheme.colors.textSecondary,
        )
    }
}
