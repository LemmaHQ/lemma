package dev.lemmahq.lemma

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.showcase.DesignShowcase

@Composable
fun App() {
    var isDark by remember { mutableStateOf(false) }

    LemmaTheme(darkTheme = isDark) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding()
        ) {
            DesignShowcase(
                onToggleTheme = { isDark = !isDark }
            )
        }
    }
}
