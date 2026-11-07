package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

@Composable
fun LemmaDropdownMenuItem(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: DrawableResource? = null,
    destructive: Boolean = false,
) {
    val color = if (destructive) LemmaTheme.colors.danger else LemmaTheme.colors.textPrimary
    DropdownMenuItem(
        text = {
            Text(
                text = title,
                style = LemmaTheme.typography.bodyLarge,
                color = color,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        leadingIcon =
            icon?.let {
                {
                    Icon(
                        painter = painterResource(it),
                        contentDescription = null,
                        tint = color,
                        modifier = Modifier.size(20.dp),
                    )
                }
            },
        onClick = onClick,
        modifier = modifier,
    )
}
