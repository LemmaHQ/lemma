package io.github.mistvesper.lemma.ui.agent

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaSpinner
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_thinking_pending
import org.jetbrains.compose.resources.stringResource

/** Shows that the model works on a reply step that has nothing to show yet. */
@Composable
internal fun ThinkingLoader() {
    val pulse by
        rememberInfiniteTransition()
            .animateFloat(
                initialValue = 1f,
                targetValue = 0.45f,
                animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
            )
    Row(
        modifier =
            Modifier.heightIn(min = 32.dp)
                .border(1.dp, LemmaTheme.colors.border, LemmaTheme.shapes.md)
                .padding(horizontal = 12.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LemmaSpinner()
        Text(
            text = stringResource(Res.string.agent_thinking_pending),
            style = LemmaTheme.typography.body,
            color = LemmaTheme.colors.mutedForeground,
            modifier = Modifier.alpha(pulse),
        )
    }
}
