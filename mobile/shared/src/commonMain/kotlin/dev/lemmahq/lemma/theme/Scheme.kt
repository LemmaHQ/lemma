package dev.lemmahq.lemma.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

@Immutable
data class LemmaColorScheme(
    val primary: Color,
    val primaryHover: Color,
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
    val success: Color,
    val warning: Color,
    val isDark: Boolean
)

val LightLemmaColorScheme = LemmaColorScheme(
    primary = LemmaColors.PrimaryLight,
    primaryHover = LemmaColors.PrimaryHoverLight,
    background = LemmaColors.BgPrimaryLight,
    backgroundSecondary = LemmaColors.BgSecondaryLight,
    backgroundGroup = LemmaColors.BgGroupLight,
    textPrimary = LemmaColors.LabelsPrimaryLight,
    textSecondary = LemmaColors.LabelsSecondaryLight,
    textTertiary = LemmaColors.LabelsTertiaryLight,
    textQuaternary = LemmaColors.LabelsQuaternaryLight,
    fill1 = LemmaColors.F1Light,
    fill2 = LemmaColors.F2Light,
    fill3 = LemmaColors.F3Light,
    separator = LemmaColors.SeparatorLight,
    userBubble = LemmaColors.PrimaryLight,
    userBubbleText = LemmaColors.White,
    assistantBubble = LemmaColors.BubbleGrayLight,
    assistantBubbleText = LemmaColors.LabelsPrimaryLight,
    danger = LemmaColors.RedLight,
    success = LemmaColors.GreenLight,
    warning = LemmaColors.Yellow,
    isDark = false
)

val DarkLemmaColorScheme = LemmaColorScheme(
    primary = LemmaColors.PrimaryDark,
    primaryHover = LemmaColors.PrimaryHoverDark,
    background = LemmaColors.BgPrimaryDark,
    backgroundSecondary = LemmaColors.BgSecondaryDark,
    backgroundGroup = LemmaColors.BgGroupDark,
    textPrimary = LemmaColors.LabelsPrimaryDark,
    textSecondary = LemmaColors.LabelsSecondaryDark,
    textTertiary = LemmaColors.LabelsTertiaryDark,
    textQuaternary = LemmaColors.LabelsQuaternaryDark,
    fill1 = LemmaColors.F1Dark,
    fill2 = LemmaColors.F2Dark,
    fill3 = LemmaColors.F3Dark,
    separator = LemmaColors.SeparatorDark,
    userBubble = LemmaColors.PrimaryDark,
    userBubbleText = LemmaColors.White,
    assistantBubble = LemmaColors.BubbleGrayDark,
    assistantBubbleText = LemmaColors.LabelsPrimaryDark,
    danger = LemmaColors.RedDark,
    success = LemmaColors.GreenDark,
    warning = LemmaColors.Yellow,
    isDark = true
)
