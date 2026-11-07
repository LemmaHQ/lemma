package dev.lemmahq.lemma.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import dev.snipme.highlights.Highlights
import dev.snipme.highlights.model.ColorHighlight
import dev.snipme.highlights.model.SyntaxLanguage
import dev.snipme.highlights.model.SyntaxThemes

private val LANGUAGE_ALIASES =
    mapOf(
        "bash" to SyntaxLanguage.SHELL,
        "c#" to SyntaxLanguage.CSHARP,
        "c++" to SyntaxLanguage.CPP,
        "cc" to SyntaxLanguage.CPP,
        "coffee" to SyntaxLanguage.COFFEESCRIPT,
        "cs" to SyntaxLanguage.CSHARP,
        "cxx" to SyntaxLanguage.CPP,
        "golang" to SyntaxLanguage.GO,
        "h" to SyntaxLanguage.C,
        "hpp" to SyntaxLanguage.CPP,
        "js" to SyntaxLanguage.JAVASCRIPT,
        "jsx" to SyntaxLanguage.JAVASCRIPT,
        "kt" to SyntaxLanguage.KOTLIN,
        "kts" to SyntaxLanguage.KOTLIN,
        "pl" to SyntaxLanguage.PERL,
        "py" to SyntaxLanguage.PYTHON,
        "rb" to SyntaxLanguage.RUBY,
        "rs" to SyntaxLanguage.RUST,
        "sh" to SyntaxLanguage.SHELL,
        "ts" to SyntaxLanguage.TYPESCRIPT,
        "tsx" to SyntaxLanguage.TYPESCRIPT,
        "zsh" to SyntaxLanguage.SHELL,
    )

/** The highlighter grammar for a code fence's [language] name; the plain grammar for others. */
internal fun syntaxLanguage(language: String?): SyntaxLanguage {
    val name = language.orEmpty().trim().lowercase()
    return LANGUAGE_ALIASES[name] ?: SyntaxLanguage.getByName(name) ?: SyntaxLanguage.DEFAULT
}

/** The color of plain code text in the Atom One theme for the light or [dark] scheme. */
internal fun codeTextColor(dark: Boolean) = themeColor(SyntaxThemes.atom(darkMode = dark).code)

/**
 * [code] with its tokens colored in the Atom One theme for the light or [dark] scheme; punctuation
 * and the text between tokens stay plain, drawn in [codeTextColor].
 */
internal fun highlightCode(code: String, language: String?, dark: Boolean): AnnotatedString {
    val atom = SyntaxThemes.atom(darkMode = dark)
    val highlights =
        Highlights.Builder()
            .code(code)
            .language(syntaxLanguage(language))
            .theme(atom.copy(punctuation = atom.code))
            .build()
            .getHighlights()
    return buildAnnotatedString {
        append(code)
        for (highlight in highlights.filterIsInstance<ColorHighlight>()) {
            addStyle(
                SpanStyle(color = themeColor(highlight.rgb)),
                highlight.location.start,
                highlight.location.end,
            )
        }
    }
}

private fun themeColor(rgb: Int) = Color(rgb).copy(alpha = 1f)
