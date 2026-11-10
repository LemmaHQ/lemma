package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

/** A dialog asking to confirm one action; [destructive] styles the confirm button as dangerous. */
@Composable
fun LemmaConfirmDialog(
    title: String,
    description: String,
    confirmLabel: String,
    dismissLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    destructive: Boolean = false,
) {
    LemmaDialog(
        title = title,
        dismissLabel = dismissLabel,
        confirmLabel = confirmLabel,
        onConfirm = onConfirm,
        onDismiss = onDismiss,
        confirmVariant =
            if (destructive) LemmaButtonVariant.Destructive else LemmaButtonVariant.Primary,
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = description,
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
        )
    }
}
