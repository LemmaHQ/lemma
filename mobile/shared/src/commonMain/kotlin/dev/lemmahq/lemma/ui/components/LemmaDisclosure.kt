package dev.lemmahq.lemma.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_chevron_down
import org.jetbrains.compose.resources.painterResource

/** Makes the element a button that shows or hides content, announcing whether it is [expanded]. */
fun Modifier.lemmaDisclosure(expanded: Boolean, onToggle: () -> Unit): Modifier =
    clickable(role = Role.Button, onClick = onToggle).semantics {
        if (expanded) {
            collapse {
                onToggle()
                true
            }
        } else {
            expand {
                onToggle()
                true
            }
        }
    }

/** A chevron that points down while collapsed and turns up once [expanded]. */
@Composable
fun LemmaDisclosureChevron(
    expanded: Boolean,
    modifier: Modifier = Modifier,
    size: Dp = 14.dp,
    tint: Color = LemmaTheme.colors.textTertiary,
) {
    val rotation by animateFloatAsState(if (expanded) 180f else 0f)
    Icon(
        painter = painterResource(Res.drawable.icon_chevron_down),
        contentDescription = null,
        tint = tint,
        modifier = modifier.size(size).rotate(rotation),
    )
}
