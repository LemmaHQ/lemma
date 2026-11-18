package io.github.mistvesper.lemma.ui.components

import androidx.compose.ui.graphics.Color
import io.github.mistvesper.lemma.theme.LemmaColorScheme

enum class LemmaButtonVariant {
    Primary,
    Secondary,
    Destructive;

    /** The fill of a button of this variant in [colors]. */
    fun background(colors: LemmaColorScheme): Color =
        when (this) {
            Primary -> colors.primary
            Secondary -> colors.secondary
            Destructive -> colors.destructiveSubtle
        }

    /** The text and icon color of a button of this variant in [colors]. */
    fun content(colors: LemmaColorScheme): Color =
        when (this) {
            Primary -> colors.primaryForeground
            Secondary -> colors.secondaryForeground
            Destructive -> colors.destructive
        }
}
