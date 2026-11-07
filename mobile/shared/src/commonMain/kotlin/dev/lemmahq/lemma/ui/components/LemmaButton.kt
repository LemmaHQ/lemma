package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

@Composable
fun LemmaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: LemmaButtonVariant = LemmaButtonVariant.Primary,
    enabled: Boolean = true,
    icon: DrawableResource? = null,
) {
    val backgroundColor =
        when (variant) {
            LemmaButtonVariant.Primary ->
                if (enabled) LemmaTheme.colors.primary else LemmaTheme.colors.fill2
            LemmaButtonVariant.Secondary ->
                if (enabled) LemmaTheme.colors.fill2 else LemmaTheme.colors.fill1
            LemmaButtonVariant.Destructive ->
                if (enabled) LemmaTheme.colors.danger else LemmaTheme.colors.fill2
        }

    val textColor =
        when (variant) {
            LemmaButtonVariant.Primary,
            LemmaButtonVariant.Destructive ->
                if (enabled) Color.White else LemmaTheme.colors.textQuaternary
            LemmaButtonVariant.Secondary ->
                if (enabled) LemmaTheme.colors.textPrimary else LemmaTheme.colors.textQuaternary
        }

    Row(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .clip(LemmaTheme.shapes.full)
                .background(backgroundColor)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                painter = painterResource(icon),
                contentDescription = null,
                tint = textColor,
                modifier = Modifier.size(16.dp),
            )
        }
        Text(text = text, color = textColor, style = LemmaTheme.typography.bodyMedium)
    }
}
