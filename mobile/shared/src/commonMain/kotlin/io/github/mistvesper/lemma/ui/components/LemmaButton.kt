package io.github.mistvesper.lemma.ui.components

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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.DISABLED_ALPHA
import io.github.mistvesper.lemma.theme.LemmaTheme
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
    val backgroundColor = variant.background(LemmaTheme.colors)
    val textColor = variant.content(LemmaTheme.colors)

    Row(
        modifier =
            modifier
                .heightIn(min = 44.dp)
                .alpha(if (enabled) 1f else DISABLED_ALPHA)
                .clip(LemmaTheme.shapes.md)
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
        Text(text = text, color = textColor, style = LemmaTheme.typography.body)
    }
}
