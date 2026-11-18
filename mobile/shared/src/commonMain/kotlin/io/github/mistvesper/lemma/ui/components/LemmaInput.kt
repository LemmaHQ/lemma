package io.github.mistvesper.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.DISABLED_ALPHA
import io.github.mistvesper.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_arrow_up
import org.jetbrains.compose.resources.painterResource

/**
 * A box of [header] sections above a message field and a footer row of [footer] controls with a
 * round button that sends the text while [canSend]; [focusRequester] moves the keyboard focus into
 * the field.
 */
@Composable
fun LemmaInput(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    sendDescription: String,
    canSend: Boolean,
    onSend: () -> Unit,
    focusRequester: FocusRequester,
    header: @Composable ColumnScope.() -> Unit,
    modifier: Modifier = Modifier,
    footer: @Composable RowScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(LemmaTheme.shapes.lg)
                .background(LemmaTheme.colors.background)
                .border(1.dp, LemmaTheme.colors.input, LemmaTheme.shapes.lg)
    ) {
        header()
        Box(modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 10.dp)) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = LemmaTheme.colors.subtleForeground,
                    style = LemmaTheme.typography.reading,
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle =
                    LemmaTheme.typography.reading.copy(color = LemmaTheme.colors.foreground),
                cursorBrush = SolidColor(LemmaTheme.colors.brand),
                maxLines = 6,
                modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            footer()
            Spacer(modifier = Modifier.weight(1f))
            SendButton(description = sendDescription, enabled = canSend, onClick = onSend)
        }
    }
}

@Composable
private fun SendButton(description: String, enabled: Boolean, onClick: () -> Unit) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.alpha(if (enabled) 1f else DISABLED_ALPHA),
        colors =
            IconButtonDefaults.iconButtonColors(
                containerColor = LemmaTheme.colors.primary,
                contentColor = LemmaTheme.colors.primaryForeground,
                disabledContainerColor = LemmaTheme.colors.primary,
                disabledContentColor = LemmaTheme.colors.primaryForeground,
            ),
        shape = CircleShape,
    ) {
        Icon(
            painter = painterResource(Res.drawable.icon_arrow_up),
            contentDescription = description,
            modifier = Modifier.size(18.dp),
        )
    }
}
