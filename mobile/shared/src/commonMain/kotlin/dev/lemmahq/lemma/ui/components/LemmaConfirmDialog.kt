package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
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
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier.clip(LemmaTheme.shapes.large)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
        ) {
            Text(
                text = title,
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LemmaButton(
                    text = dismissLabel,
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LemmaButtonVariant.Secondary,
                )
                LemmaButton(
                    text = confirmLabel,
                    onClick = onConfirm,
                    modifier = Modifier.weight(1f),
                    variant =
                        if (destructive) LemmaButtonVariant.Destructive
                        else LemmaButtonVariant.Primary,
                )
            }
        }
    }
}
