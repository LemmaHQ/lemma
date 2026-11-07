package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * [code] in [language], highlighted off the main thread and scrolled sideways when wider than the
 * block. Until a longer [code] is highlighted, its highlighted prefix keeps its colors.
 */
@Composable
@Suppress("InjectDispatcher")
fun LemmaCode(code: String, language: String?, modifier: Modifier = Modifier) {
    val dark = LemmaTheme.colors.isDark
    val highlighted by
        produceState(AnnotatedString(code), code, language, dark) {
            value = withContext(Dispatchers.Default) { highlightCode(code, language, dark) }
        }
    val shown =
        when {
            highlighted.text == code -> highlighted
            code.startsWith(highlighted.text) -> AnnotatedString(code, highlighted.spanStyles)
            else -> AnnotatedString(code)
        }
    Text(
        text = shown,
        color = codeTextColor(dark),
        style =
            LemmaTheme.typography.bodyMedium.copy(
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                lineHeight = 19.sp,
            ),
        softWrap = false,
        modifier =
            modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 10.dp),
    )
}
