package dev.lemmahq.lemma.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

val LocalLemmaColors = staticCompositionLocalOf { LightLemmaColorScheme }
val LocalLemmaTypography = staticCompositionLocalOf { LemmaTypography() }
val LocalLemmaShapes = staticCompositionLocalOf { LemmaShapes() }

object LemmaTheme {
    val colors: LemmaColorScheme
        @Composable
        @ReadOnlyComposable
        get() = LocalLemmaColors.current

    val typography: LemmaTypography
        @Composable
        @ReadOnlyComposable
        get() = LocalLemmaTypography.current

    val shapes: LemmaShapes
        @Composable
        @ReadOnlyComposable
        get() = LocalLemmaShapes.current
}

@Composable
fun LemmaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkLemmaColorScheme else LightLemmaColorScheme
    val typography = LemmaTypography()
    val shapes = LemmaShapes()

    CompositionLocalProvider(
        LocalLemmaColors provides colorScheme,
        LocalLemmaTypography provides typography,
        LocalLemmaShapes provides shapes,
        content = content
    )
}
