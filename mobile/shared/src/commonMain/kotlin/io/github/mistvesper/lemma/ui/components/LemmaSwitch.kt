package io.github.mistvesper.lemma.ui.components

import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import io.github.mistvesper.lemma.theme.DISABLED_ALPHA
import io.github.mistvesper.lemma.theme.LemmaTheme

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
        modifier = modifier.alpha(if (enabled) 1f else DISABLED_ALPHA),
        enabled = enabled,
        colors =
            SwitchDefaults.colors(
                checkedThumbColor = LemmaTheme.colors.thumb,
                checkedTrackColor = LemmaTheme.colors.primary,
                uncheckedThumbColor = LemmaTheme.colors.thumb,
                uncheckedTrackColor = LemmaTheme.colors.track,
                uncheckedBorderColor = Color.Transparent,
                disabledCheckedThumbColor = LemmaTheme.colors.thumb,
                disabledCheckedTrackColor = LemmaTheme.colors.primary,
                disabledUncheckedThumbColor = LemmaTheme.colors.thumb,
                disabledUncheckedTrackColor = LemmaTheme.colors.track,
                disabledUncheckedBorderColor = Color.Transparent,
            ),
    )
}
