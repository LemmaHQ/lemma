package com.lemmaos.lemma.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Design tokens mirrored from web/src/styles/theme.css (see DESIGN.md).
// oklch() values are pre-converted to sRGB; keep both files in sync when tokens change.

private val lightBackground = Color(0xFFFDFBFD)
private val lightForeground = Color(0xFF16181D)
private val lightCard = Color(0xFFFFFFFF)
private val lightCardForeground = Color(0xFF16181D)
private val lightPopover = Color(0xFFFFFFFF)
private val lightPopoverForeground = Color(0xFF16181D)
private val lightPrimary = Color(0xFF60B1FF)
private val lightPrimaryForeground = Color(0xFF0B1220)
private val lightSecondary = Color(0xFFF0F2F4)
private val lightSecondaryForeground = Color(0xFF2B2E33)
private val lightMuted = Color(0xFFF2F3F5)
private val lightMutedForeground = Color(0xFF5F636A)
private val lightAccent = Color(0xFFEEF0F4)
private val lightAccentForeground = Color(0xFF232933)
private val lightDestructive = Color(0xFFC53637)
private val lightDestructiveForeground = Color(0xFFF8F8F8)
private val lightWarning = Color(0xFFB45309)
private val lightWarningSoft = Color(0xFFFFFBEB)
private val lightWarningBorder = Color(0xFFFCD34D)
private val lightSuccess = Color(0xFF27A644)
private val lightBorder = Color(0xFFDFE1E5)
private val lightInput = Color(0xFFDFE1E5)
private val lightSidebar = Color(0xFFFCF8FB)
private val lightSidebarForeground = Color(0xFF16181D)
private val lightSidebarBorder = Color(0xFFDFE1E5)
private val lightSidebarAccent = Color(0xFFF4F3F2)
private val lightSidebarAccentForeground = Color(0xFF232933)
private val lightCode = Color(0xFFF0F2F4)
private val lightCodeForeground = Color(0xFF232933)
private val lightCodeBorder = Color(0xFFDFE1E5)
private val lightComposer = Color(0xFFFFFFFF)

private val darkBackground = Color(0xFF151615)
private val darkForeground = Color(0xFFE3E5E8)
private val darkCard = Color(0xFF1D1F23)
private val darkCardForeground = Color(0xFFE3E5E8)
private val darkPopover = Color(0xFF1D1F23)
private val darkPopoverForeground = Color(0xFFE3E5E8)
private val darkPrimary = Color(0xFF60B1FF)
private val darkPrimaryForeground = Color(0xFF0B1220)
private val darkSecondary = Color(0xFF24272B)
private val darkSecondaryForeground = Color(0xFFCCCED1)
private val darkMuted = Color(0xFF222428)
private val darkMutedForeground = Color(0xFF91959D)
private val darkAccent = Color(0xFF292B30)
private val darkAccentForeground = Color(0xFFE1E5EB)
private val darkDestructive = Color(0xFFDA534F)
private val darkDestructiveForeground = Color(0xFFF5F5F5)
private val darkWarning = Color(0xFFFBBF24)
private val darkWarningSoft = Color(0xFF451A03)
private val darkWarningBorder = Color(0xFF92400E)
private val darkSuccess = Color(0xFF3FB950)
private val darkBorder = Color(0xFF2E3035)
private val darkInput = Color(0xFF35383D)
private val darkSidebar = Color(0xFF000000)
private val darkSidebarForeground = Color(0xFFE3E5E8)
private val darkSidebarBorder = Color(0xFF2E3035)
private val darkSidebarAccent = Color(0xFF212429)
private val darkSidebarAccentForeground = Color(0xFFE1E5EB)
private val darkCode = Color(0xFF1F2226)
private val darkCodeForeground = Color(0xFFD0D4DB)
private val darkCodeBorder = Color(0xFF2E3035)
private val darkComposer = Color(0xFF252528)

/** Brand tokens that have no Material 3 slot. */
@Immutable
data class LemmaColors(
    val sidebar: Color,
    val sidebarForeground: Color,
    val sidebarBorder: Color,
    val sidebarAccent: Color,
    val sidebarAccentForeground: Color,
    val composer: Color,
    val code: Color,
    val codeForeground: Color,
    val codeBorder: Color,
    val success: Color,
    val warning: Color,
    val warningSoft: Color,
    val warningBorder: Color,
)

private val LightLemmaColors = LemmaColors(
    sidebar = lightSidebar,
    sidebarForeground = lightSidebarForeground,
    sidebarBorder = lightSidebarBorder,
    sidebarAccent = lightSidebarAccent,
    sidebarAccentForeground = lightSidebarAccentForeground,
    composer = lightComposer,
    code = lightCode,
    codeForeground = lightCodeForeground,
    codeBorder = lightCodeBorder,
    success = lightSuccess,
    warning = lightWarning,
    warningSoft = lightWarningSoft,
    warningBorder = lightWarningBorder,
)

private val DarkLemmaColors = LemmaColors(
    sidebar = darkSidebar,
    sidebarForeground = darkSidebarForeground,
    sidebarBorder = darkSidebarBorder,
    sidebarAccent = darkSidebarAccent,
    sidebarAccentForeground = darkSidebarAccentForeground,
    composer = darkComposer,
    code = darkCode,
    codeForeground = darkCodeForeground,
    codeBorder = darkCodeBorder,
    success = darkSuccess,
    warning = darkWarning,
    warningSoft = darkWarningSoft,
    warningBorder = darkWarningBorder,
)

val LocalLemmaColors = staticCompositionLocalOf { LightLemmaColors }

private val LightScheme = lightColorScheme(
    primary = lightPrimary,
    onPrimary = lightPrimaryForeground,
    primaryContainer = lightAccent,
    onPrimaryContainer = lightAccentForeground,
    secondary = lightSecondaryForeground,
    onSecondary = lightSecondary,
    secondaryContainer = lightSecondary,
    onSecondaryContainer = lightSecondaryForeground,
    tertiary = lightAccentForeground,
    onTertiary = lightAccent,
    background = lightBackground,
    onBackground = lightForeground,
    surface = lightCard,
    onSurface = lightCardForeground,
    surfaceVariant = lightMuted,
    onSurfaceVariant = lightMutedForeground,
    surfaceContainer = lightPopover,
    surfaceContainerHigh = lightPopover,
    surfaceContainerHighest = lightMuted,
    error = lightDestructive,
    onError = lightDestructiveForeground,
    outline = lightBorder,
    outlineVariant = lightInput,
)

private val DarkScheme = darkColorScheme(
    primary = darkPrimary,
    onPrimary = darkPrimaryForeground,
    primaryContainer = darkAccent,
    onPrimaryContainer = darkAccentForeground,
    secondary = darkSecondaryForeground,
    onSecondary = darkSecondary,
    secondaryContainer = darkSecondary,
    onSecondaryContainer = darkSecondaryForeground,
    tertiary = darkAccentForeground,
    onTertiary = darkAccent,
    background = darkBackground,
    onBackground = darkForeground,
    surface = darkCard,
    onSurface = darkCardForeground,
    surfaceVariant = darkMuted,
    onSurfaceVariant = darkMutedForeground,
    surfaceContainer = darkPopover,
    surfaceContainerHigh = darkPopover,
    surfaceContainerHighest = darkMuted,
    error = darkDestructive,
    onError = darkDestructiveForeground,
    outline = darkBorder,
    outlineVariant = darkInput,
)

private val LemmaShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(10.dp),
    large = RoundedCornerShape(14.dp),
    extraLarge = RoundedCornerShape(20.dp),
)

@Composable
fun LemmaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalLemmaColors provides if (darkTheme) DarkLemmaColors else LightLemmaColors,
    ) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            shapes = LemmaShapes,
            content = content,
        )
    }
}
