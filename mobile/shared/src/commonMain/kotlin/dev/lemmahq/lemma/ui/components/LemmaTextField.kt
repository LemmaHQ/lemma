package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.DISABLED_ALPHA
import dev.lemmahq.lemma.theme.LemmaTheme
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

/**
 * An input on the control surface; [trailingContent] takes the place of the end and vertical
 * padding.
 */
@Composable
fun LemmaTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    singleLine: Boolean = true,
    leadingIcon: DrawableResource? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingContent: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .heightIn(min = 52.dp)
                .alpha(if (enabled) 1f else DISABLED_ALPHA)
                .clip(LemmaTheme.shapes.md)
                .background(LemmaTheme.colors.control)
                .border(1.dp, LemmaTheme.colors.input, LemmaTheme.shapes.md)
                .padding(start = 16.dp, end = if (trailingContent == null) 16.dp else 4.dp)
                .padding(vertical = if (trailingContent == null) 14.dp else 0.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingIcon != null) {
            Icon(
                painter = painterResource(leadingIcon),
                contentDescription = null,
                tint = LemmaTheme.colors.subtleForeground,
                modifier = Modifier.size(18.dp),
            )
            Spacer(modifier = Modifier.width(10.dp))
        }
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = LemmaTheme.colors.subtleForeground,
                    style = LemmaTheme.typography.reading,
                    maxLines = 1,
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = singleLine,
                visualTransformation = visualTransformation,
                keyboardOptions = keyboardOptions,
                textStyle =
                    LemmaTheme.typography.reading.copy(color = LemmaTheme.colors.foreground),
                cursorBrush = SolidColor(LemmaTheme.colors.brand),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        trailingContent?.invoke()
    }
}
