package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaBottomSheet
import io.github.mistvesper.lemma.ui.components.LemmaCode
import io.github.mistvesper.lemma.ui.components.LemmaCopyButton
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_copy_code
import lemma.mobile.shared.generated.resources.session_code_title
import org.jetbrains.compose.resources.stringResource

/** A code block from a reply in a sheet titled with its [language], or "Code" without one. */
@Composable
internal fun CodeSheet(code: String, language: String?, onDismiss: () -> Unit) {
    LemmaBottomSheet(
        onDismiss = onDismiss,
        title = language ?: stringResource(Res.string.session_code_title),
    ) {
        Column(modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
            CodeView(code, language)
        }
    }
}

/** [code] in [language], highlighted on the muted fill under a copy button. */
@Composable
internal fun CodeView(code: String, language: String?) {
    Column(horizontalAlignment = Alignment.End) {
        LemmaCopyButton(
            text = code,
            label = stringResource(Res.string.common_copy_code),
            iconSize = 14.dp,
        )
        SelectionContainer {
            LemmaCode(
                code = code,
                language = language,
                modifier =
                    Modifier.fillMaxWidth()
                        .clip(LemmaTheme.shapes.md)
                        .background(LemmaTheme.colors.muted),
            )
        }
    }
}
