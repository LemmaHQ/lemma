package dev.lemmahq.lemma.ui.components

import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import dev.lemmahq.lemma.theme.LemmaTheme

/** A switch; a null [onCheckedChange] leaves the toggling to an enclosing toggleable row. */
@Composable
fun LemmaSwitch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Switch(
        checked = checked,
        onCheckedChange = onCheckedChange,
        modifier = modifier,
        enabled = enabled,
        colors =
            SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = LemmaTheme.colors.primary,
                uncheckedThumbColor = LemmaTheme.colors.textTertiary,
                uncheckedTrackColor = LemmaTheme.colors.fill3,
                uncheckedBorderColor = LemmaTheme.colors.separator,
            ),
    )
}
