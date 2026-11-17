package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ApiFormat
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_api_format_anthropic
import lemma.mobile.shared.generated.resources.provider_api_format_gemini
import lemma.mobile.shared.generated.resources.provider_api_format_openai
import org.jetbrains.compose.resources.stringResource

/** Chips choosing one of [options], or displaying the immutable format when [enabled] is false. */
@Composable
internal fun ApiFormatPicker(
    apiFormat: ApiFormat,
    options: List<ApiFormat>,
    onSelect: (ApiFormat) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Row(
        modifier = modifier.selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            val selected = option == apiFormat
            Box(
                modifier =
                    Modifier.heightIn(min = 40.dp)
                        .clip(LemmaTheme.shapes.md)
                        .background(if (selected) LemmaTheme.colors.primary else Color.Transparent)
                        .border(
                            1.dp,
                            if (selected) Color.Transparent else LemmaTheme.colors.border,
                            LemmaTheme.shapes.md,
                        )
                        .selectable(
                            selected = selected,
                            role = Role.RadioButton,
                            enabled = enabled,
                            onClick = { onSelect(option) },
                        )
                        .padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option.label(),
                    style = LemmaTheme.typography.body,
                    color =
                        if (selected) LemmaTheme.colors.primaryForeground
                        else LemmaTheme.colors.mutedForeground,
                )
            }
        }
    }
}

@Composable
private fun ApiFormat.label(): String =
    stringResource(
        when (this) {
            ApiFormat.OpenAi -> Res.string.provider_api_format_openai
            ApiFormat.Anthropic -> Res.string.provider_api_format_anthropic
            ApiFormat.Gemini -> Res.string.provider_api_format_gemini
        }
    )
