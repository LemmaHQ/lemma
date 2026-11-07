package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mikepenz.markdown.compose.components.markdownComponents
import com.mikepenz.markdown.compose.elements.MarkdownCodeBlock
import com.mikepenz.markdown.compose.elements.MarkdownCodeFence
import com.mikepenz.markdown.m3.Markdown
import com.mikepenz.markdown.m3.markdownColor
import com.mikepenz.markdown.m3.markdownTypography
import com.mikepenz.markdown.model.rememberMarkdownState
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.code_copy
import org.jetbrains.compose.resources.stringResource

/**
 * Renders the markdown [content] in [color] with [style] as its body text. A growing [content]
 * keeps showing the last parsed text until the new text is parsed. Code blocks are highlighted
 * under a header with their language and a copy button.
 */
@Composable
fun LemmaMarkdown(
    content: String,
    modifier: Modifier = Modifier,
    color: Color = LemmaTheme.colors.textPrimary,
    style: TextStyle = LemmaTheme.typography.bodyLarge,
) {
    val inlineCode =
        LemmaTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
    Markdown(
        markdownState = rememberMarkdownState(content, retainState = true),
        colors =
            markdownColor(
                text = color,
                codeBackground = LemmaTheme.colors.fill2,
                dividerColor = LemmaTheme.colors.separator,
            ),
        typography =
            markdownTypography(
                h1 = LemmaTheme.typography.titleLarge,
                h2 = LemmaTheme.typography.titleMedium,
                h3 = LemmaTheme.typography.titleMedium,
                text = style,
                paragraph = style,
                code = inlineCode,
                inlineCode = inlineCode,
                textLink =
                    TextLinkStyles(
                        style =
                            SpanStyle(
                                color = LemmaTheme.colors.primary,
                                fontWeight = FontWeight.Bold,
                                textDecoration = TextDecoration.Underline,
                            )
                    ),
            ),
        components =
            markdownComponents(
                codeBlock = {
                    MarkdownCodeBlock(content = it.content, node = it.node) { code, language, _ ->
                        FencedCode(code, language)
                    }
                },
                codeFence = {
                    MarkdownCodeFence(content = it.content, node = it.node) { code, language, _ ->
                        FencedCode(code, language)
                    }
                },
            ),
        modifier = modifier,
    )
}

@Composable
private fun FencedCode(code: String, language: String?) {
    Column(
        modifier =
            Modifier.fillMaxWidth()
                .padding(vertical = 4.dp)
                .clip(LemmaTheme.shapes.medium)
                .background(LemmaTheme.colors.fill1)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = language?.trim().orEmpty(),
                style = LemmaTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace),
                color = LemmaTheme.colors.textTertiary,
                modifier = Modifier.weight(1f),
            )
            LemmaCopyButton(text = code, label = stringResource(Res.string.code_copy))
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.separator))
        LemmaCode(code = code, language = language, modifier = Modifier.fillMaxWidth())
    }
}
