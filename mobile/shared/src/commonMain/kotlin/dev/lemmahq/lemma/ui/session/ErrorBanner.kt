package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

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
                .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = message,
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.danger,
            modifier = Modifier.weight(1f),
        )
        if (showRetry) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Retry",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.primary,
                modifier = Modifier.clickable(onClick = onRetry),
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = "✕",
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
            modifier = Modifier.clickable(onClick = onDismiss),
        )
    }
}
