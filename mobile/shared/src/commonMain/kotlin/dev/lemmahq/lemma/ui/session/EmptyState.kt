package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_message_circle_plus
import lemma.mobile.shared.generated.resources.session_empty_subtitle
import lemma.mobile.shared.generated.resources.session_empty_title
import lemma.mobile.shared.generated.resources.session_suggestion_1
import lemma.mobile.shared.generated.resources.session_suggestion_2
import lemma.mobile.shared.generated.resources.session_suggestion_3
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

private val SUGGESTIONS =
    listOf(
        Res.string.session_suggestion_1,
        Res.string.session_suggestion_2,
        Res.string.session_suggestion_3,
    )

/** A session without messages: what to ask, with suggestions that [onPickSuggestion] receives. */
@Composable
internal fun EmptyState(onPickSuggestion: (String) -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier.size(40.dp)
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.fill2),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                painter = painterResource(Res.drawable.icon_message_circle_plus),
                contentDescription = null,
                tint = LemmaTheme.colors.textPrimary,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(Res.string.session_empty_title),
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = stringResource(Res.string.session_empty_subtitle),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            for (suggestion in SUGGESTIONS) {
                val text = stringResource(suggestion)
                Text(
                    text = text,
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textPrimary,
                    modifier =
                        Modifier.heightIn(min = 40.dp)
                            .clip(LemmaTheme.shapes.full)
                            .border(1.dp, LemmaTheme.colors.separator, LemmaTheme.shapes.full)
                            .clickable(role = Role.Button) { onPickSuggestion(text) }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                )
            }
        }
    }
}
