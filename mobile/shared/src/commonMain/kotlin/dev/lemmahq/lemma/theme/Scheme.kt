package dev.lemmahq.lemma.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

@Immutable
data class LemmaColorScheme(
    val primary: Color,
    val background: Color,
    val backgroundSecondary: Color,
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
    val assistantBubble: Color,
    val assistantBubbleText: Color,
    val danger: Color,
    val isDark: Boolean
)

val LightLemmaColorScheme = LemmaColorScheme(
    primary = LemmaPalette.Blue500,
    background = LemmaPalette.White,
    backgroundSecondary = LemmaPalette.Gray100,
    backgroundGroup = LemmaPalette.White,
    textPrimary = LemmaPalette.BlackAlpha90,
    textSecondary = LemmaPalette.BlackAlpha60,
    textTertiary = LemmaPalette.BlackAlpha45,
    textQuaternary = LemmaPalette.BlackAlpha27,
    fill1 = LemmaPalette.BlackAlpha3,
    fill2 = LemmaPalette.BlackAlpha5,
    fill3 = LemmaPalette.BlackAlpha15,
    separator = LemmaPalette.BlackAlpha13,
    userBubble = LemmaPalette.Blue500,
    userBubbleText = LemmaPalette.White,
    assistantBubble = LemmaPalette.Gray100,
    assistantBubbleText = LemmaPalette.BlackAlpha90,
    danger = LemmaPalette.Red600,
    isDark = false
)

val DarkLemmaColorScheme = LemmaColorScheme(
    primary = LemmaPalette.Blue400,
    background = LemmaPalette.Gray900,
    backgroundSecondary = LemmaPalette.Gray850,
    backgroundGroup = LemmaPalette.Gray850,
    textPrimary = LemmaPalette.WhiteAlpha84,
    textSecondary = LemmaPalette.WhiteAlpha56,
    textTertiary = LemmaPalette.WhiteAlpha42,
    textQuaternary = LemmaPalette.WhiteAlpha28,
    fill1 = LemmaPalette.WhiteAlpha5,
    fill2 = LemmaPalette.WhiteAlpha10,
    fill3 = LemmaPalette.WhiteAlpha18,
    separator = LemmaPalette.WhiteAlpha12,
    userBubble = LemmaPalette.Blue400,
    userBubbleText = LemmaPalette.White,
    assistantBubble = LemmaPalette.Gray800,
    assistantBubbleText = LemmaPalette.WhiteAlpha84,
    danger = LemmaPalette.Red400,
    isDark = true
)
