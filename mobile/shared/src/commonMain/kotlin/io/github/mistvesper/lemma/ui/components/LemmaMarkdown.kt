package io.github.mistvesper.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mikepenz.markdown.compose.LocalMarkdownColors
import com.mikepenz.markdown.compose.components.markdownComponents
import com.mikepenz.markdown.compose.elements.MarkdownBlockQuote
import com.mikepenz.markdown.compose.elements.MarkdownCodeBlock
import com.mikepenz.markdown.compose.elements.MarkdownCodeFence
import com.mikepenz.markdown.m3.Markdown
import com.mikepenz.markdown.m3.markdownColor
import com.mikepenz.markdown.m3.markdownTypography
import com.mikepenz.markdown.model.MarkdownColors
import com.mikepenz.markdown.model.markdownPadding
import com.mikepenz.markdown.model.rememberMarkdownState
import io.github.mistvesper.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_copy_code
import lemma.mobile.shared.generated.resources.common_open
import org.jetbrains.compose.resources.stringResource

/**
 * Renders the markdown [content] in [color] with [style] as its body text. A growing [content]
 * keeps showing the last parsed text until the new text is parsed. Code blocks are highlighted
 * under a header with their language, an open action calling [onOpenCode] with the code and its
 * language when given, and a copy button. Quotes hang off a thin line, and tables sit in a thin
 * border under a filled header row.
 */
@Composable
fun LemmaMarkdown(
    content: String,
    modifier: Modifier = Modifier,
    color: Color = LemmaTheme.colors.foreground,
    style: TextStyle = LemmaTheme.typography.reading,
    onOpenCode: ((code: String, language: String?) -> Unit)? = null,
) {
    val inlineCode =
        LemmaTheme.typography.body.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
    val quoteColors = markdownColors(LemmaTheme.colors.mutedForeground)
    Markdown(
        markdownState = rememberMarkdownState(content, retainState = true),
        colors = markdownColors(color),
        typography =
            markdownTypography(
                h1 = LemmaTheme.typography.display,
                h2 = LemmaTheme.typography.title,
                h3 = LemmaTheme.typography.title,
                text = style,
                paragraph = style,
                quote = style.copy(color = LemmaTheme.colors.input),
                code = inlineCode,
                inlineCode = inlineCode,
                table = LemmaTheme.typography.small,
                textLink =
                    TextLinkStyles(
                        style =
                            SpanStyle(
                                color = LemmaTheme.colors.brand,
                                fontWeight = FontWeight.Bold,
                                textDecoration = TextDecoration.Underline,
                            )
                    ),
            ),
        padding =
            markdownPadding(
                blockQuote = PaddingValues(start = 16.dp),
                blockQuoteBar = PaddingValues.Absolute(left = 1.dp, top = 2.dp, bottom = 2.dp),
            ),
        components =
            markdownComponents(
                codeBlock = {
                    MarkdownCodeBlock(content = it.content, node = it.node) { code, language, _ ->
                        FencedCode(code, language, onOpenCode)
                    }
                },
                codeFence = {
                    MarkdownCodeFence(content = it.content, node = it.node) { code, language, _ ->
                        FencedCode(code, language, onOpenCode)
                    }
                },
                blockQuote = {
                    CompositionLocalProvider(LocalMarkdownColors provides quoteColors) {
                        MarkdownBlockQuote(it.content, it.node, style = it.typography.quote)
                    }
                },
                table = { MarkdownTableBlock(it) },
            ),
        modifier = modifier,
    )
}

@Composable
private fun markdownColors(text: Color): MarkdownColors =
    markdownColor(
        text = text,
        codeBackground = LemmaTheme.colors.muted,
        dividerColor = LemmaTheme.colors.border,
        tableBackground = Color.Transparent,
    )

@Composable
private fun FencedCode(
    code: String,
    language: String?,
    onOpenCode: ((code: String, language: String?) -> Unit)?,
) {
    Column(
        modifier =
            Modifier.fillMaxWidth()
                .padding(vertical = 4.dp)
                .clip(LemmaTheme.shapes.md)
                .background(LemmaTheme.colors.muted)
    ) {
        Row(
            modifier =
                Modifier.fillMaxWidth()
                    .background(LemmaTheme.colors.sidebar)
                    .padding(start = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = language?.trim().orEmpty(),
                style = LemmaTheme.typography.caption.copy(fontFamily = FontFamily.Monospace),
                color = LemmaTheme.colors.subtleForeground,
                modifier = Modifier.weight(1f),
            )
            onOpenCode?.let { open ->
                Text(
                    text = stringResource(Res.string.common_open),
                    style = LemmaTheme.typography.caption.copy(fontWeight = FontWeight.Medium),
                    color = LemmaTheme.colors.mutedForeground,
                    modifier =
                        Modifier.minimumInteractiveComponentSize()
                            .clip(LemmaTheme.shapes.sm)
                            .clickable(role = Role.Button) { open(code, language) }
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
            LemmaCopyButton(text = code, label = stringResource(Res.string.common_copy_code))
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.border))
        LemmaCode(code = code, language = language, modifier = Modifier.fillMaxWidth())
    }
}
