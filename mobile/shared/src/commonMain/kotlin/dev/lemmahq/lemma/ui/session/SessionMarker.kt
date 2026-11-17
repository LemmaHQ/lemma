package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import dev.lemmahq.lemma.theme.LemmaColorScheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.session_marker_failed
import lemma.mobile.shared.generated.resources.session_marker_finished
import lemma.mobile.shared.generated.resources.session_marker_running
import org.jetbrains.compose.resources.StringResource

/**
 * The status a session row shows in place of its time: a filled `brand` dot while running, a filled
 * `completion` square once finished, and a hollow `completion` square after a failure.
 */
internal enum class SessionMarker {
    Running,
    Finished,
    Failed;

    /** What screen readers announce for this marker. */
    val description: StringResource
        get() =
            when (this) {
                Running -> Res.string.session_marker_running
                Finished -> Res.string.session_marker_finished
                Failed -> Res.string.session_marker_failed
            }

    val shape: Shape
        get() = if (this == Running) CircleShape else RectangleShape

    /** Whether the marker draws only its outline. */
    val outlined: Boolean
        get() = this == Failed

    /** The marker's color in [colors]. */
    fun color(colors: LemmaColorScheme): Color =
        if (this == Running) colors.brand else colors.completion
}
