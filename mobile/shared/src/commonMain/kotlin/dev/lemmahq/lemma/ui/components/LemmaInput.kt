package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_arrow_up
import lemma.mobile.shared.generated.resources.icon_square
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

/**
 * A message field with a round button that sends the text, or stops the reply while [isStreaming];
 * [focusRequester] moves the keyboard focus into the field.
 */
@Composable
fun LemmaInput(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    sendDescription: String,
    onSend: () -> Unit,
    focusRequester: FocusRequester,
    modifier: Modifier = Modifier,
    isStreaming: Boolean = false,
    stopDescription: String = "",
    onStop: () -> Unit = {},
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(LemmaTheme.shapes.full)
                .background(LemmaTheme.colors.fill2)
                .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.weight(1f).padding(vertical = 12.dp)) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = LemmaTheme.colors.textTertiary,
                    style = LemmaTheme.typography.bodyMedium,
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle =
                    LemmaTheme.typography.bodyMedium.copy(color = LemmaTheme.colors.textPrimary),
                cursorBrush = SolidColor(LemmaTheme.colors.primary),
                maxLines = 6,
                modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
            )
        }
        if (isStreaming) {
            RoundButton(Res.drawable.icon_square, stopDescription, enabled = true, onClick = onStop)
        } else {
            RoundButton(
                Res.drawable.icon_arrow_up,
                sendDescription,
                enabled = value.isNotBlank(),
                onClick = onSend,
            )
        }
    }
}

@Composable
private fun RoundButton(
    icon: DrawableResource,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        colors =
            IconButtonDefaults.iconButtonColors(
                containerColor = LemmaTheme.colors.primary,
                contentColor = LemmaTheme.colors.userBubbleText,
                disabledContainerColor = LemmaTheme.colors.fill3,
                disabledContentColor = LemmaTheme.colors.textQuaternary,
            ),
        shape = CircleShape,
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = description,
            modifier = Modifier.size(18.dp),
        )
    }
}
