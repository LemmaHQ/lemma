package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mikepenz.markdown.compose.components.markdownComponents
import com.mikepenz.markdown.m3.Markdown
import com.mikepenz.markdown.m3.markdownColor
import com.mikepenz.markdown.m3.markdownTypography
import com.mikepenz.markdown.model.MarkdownColors
import com.mikepenz.markdown.model.MarkdownTypography
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
fun LemmaMarkdown(
    content: String,
    modifier: Modifier = Modifier
) {
    val colors: MarkdownColors = markdownColor(
        text = LemmaTheme.colors.assistantBubbleText,
        codeText = LemmaTheme.colors.textPrimary,
        linkText = LemmaTheme.colors.primary,
        codeBackground = LemmaTheme.colors.fill2,
        dividerColor = LemmaTheme.colors.separator
    )

    val typography: MarkdownTypography = markdownTypography(
        h1 = LemmaTheme.typography.titleLarge,
        h2 = LemmaTheme.typography.titleMedium,
        h3 = LemmaTheme.typography.titleMedium,
        text = LemmaTheme.typography.bodyLarge,
        paragraph = LemmaTheme.typography.bodyLarge,
        code = LemmaTheme.typography.bodyMedium.copy(
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            lineHeight = 18.sp
        ),
        inlineCode = LemmaTheme.typography.bodyMedium.copy(
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp
        )
    )

    val components = markdownComponents(
        codeBlock = {
            val scrollState = rememberScrollState()
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.fill2)
                    .horizontalScroll(scrollState)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(
                    text = it.content,
                    color = LemmaTheme.colors.textPrimary,
                    style = LemmaTheme.typography.bodyMedium.copy(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                )
            }
        },
        codeFence = {
            val scrollState = rememberScrollState()
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.fill2)
                    .horizontalScroll(scrollState)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(
                    text = it.content,
                    color = LemmaTheme.colors.textPrimary,
                    style = LemmaTheme.typography.bodyMedium.copy(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                )
            }
        }
    )

    Markdown(
        content = content,
        colors = colors,
        typography = typography,
        components = components,
        modifier = modifier
    )
}
