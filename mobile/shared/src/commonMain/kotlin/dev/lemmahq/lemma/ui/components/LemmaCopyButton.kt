package dev.lemmahq.lemma.ui.components

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_copied
import lemma.mobile.shared.generated.resources.icon_check
import lemma.mobile.shared.generated.resources.icon_copy
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

private const val COPIED_MILLIS = 2_000L

/**
 * Copies [text] to the clipboard; for two seconds afterwards the icon is a check and the button
 * reads and announces that the text was copied instead of [label].
 */
@Composable
fun LemmaCopyButton(
    text: String,
    label: String,
    modifier: Modifier = Modifier,
    iconSize: Dp = 16.dp,
) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    var copied by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) {
            delay(COPIED_MILLIS)
            copied = false
        }
    }
    val description = if (copied) stringResource(Res.string.common_copied) else label
    IconButton(
        onClick = {
            scope.launch {
                clipboard.setClipEntry(plainTextClipEntry(text))
                copied = true
            }
        },
        modifier =
            modifier.size(48.dp).semantics {
                contentDescription = description
                liveRegion = LiveRegionMode.Polite
            },
    ) {
        Crossfade(targetState = copied) { done ->
            Icon(
                painter =
                    painterResource(if (done) Res.drawable.icon_check else Res.drawable.icon_copy),
                contentDescription = null,
                tint = LemmaTheme.colors.textSecondary,
                modifier = Modifier.size(iconSize),
            )
        }
    }
}
