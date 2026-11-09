package dev.lemmahq.lemma.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/** The app's color roles; [isDark] marks the dark scheme for content that picks its own colors. */
@Immutable
data class LemmaColorScheme(
    val isDark: Boolean,
    val primary: Color,
    val background: Color,
    val backgroundGroup: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val textQuaternary: Color,
    val fill1: Color,
    val fill2: Color,
    val fill3: Color,
    val separator: Color,
    val userBubble: Color,
    val userBubbleText: Color,
    val danger: Color,
)

val LightLemmaColorScheme =
    LemmaColorScheme(
        isDark = false,
        primary = LemmaPalette.Blue600,
        background = LemmaPalette.White,
        backgroundGroup = LemmaPalette.White,
        textPrimary = LemmaPalette.Gray950,
        textSecondary = LemmaPalette.Gray600,
        textTertiary = LemmaPalette.Gray500,
        textQuaternary = LemmaPalette.Gray400,
        fill1 = LemmaPalette.BlackAlpha3,
        fill2 = LemmaPalette.BlackAlpha5,
        fill3 = LemmaPalette.BlackAlpha15,
        separator = LemmaPalette.BlackAlpha13,
        userBubble = LemmaPalette.Blue600,
        userBubbleText = LemmaPalette.White,
        danger = LemmaPalette.Red600,
    )

val DarkLemmaColorScheme =
    LemmaColorScheme(
        isDark = true,
        primary = LemmaPalette.Blue400,
        background = LemmaPalette.Gray850,
        backgroundGroup = LemmaPalette.Gray825,
        textPrimary = LemmaPalette.Gray50,
        textSecondary = LemmaPalette.Gray350,
        textTertiary = LemmaPalette.Gray450,
        textQuaternary = LemmaPalette.Gray600,
        fill1 = LemmaPalette.WhiteAlpha5,
        fill2 = LemmaPalette.WhiteAlpha10,
        fill3 = LemmaPalette.WhiteAlpha18,
        separator = LemmaPalette.WhiteAlpha12,
        userBubble = LemmaPalette.Blue600,
        userBubbleText = LemmaPalette.White,
        danger = LemmaPalette.Red400,
    )
