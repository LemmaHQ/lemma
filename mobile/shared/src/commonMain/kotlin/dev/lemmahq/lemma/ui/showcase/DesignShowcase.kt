package dev.lemmahq.lemma.ui.showcase

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaBubble
import dev.lemmahq.lemma.ui.components.LemmaBubbleRole
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaInput

@Composable
fun DesignShowcase(
    onToggleTheme: () -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(LemmaTheme.colors.background)
            .padding(16.dp)
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Lemma Design System",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary
            )
            LemmaButton(
                text = if (LemmaTheme.colors.isDark) "Light" else "Dark",
                variant = LemmaButtonVariant.Secondary,
                onClick = onToggleTheme
            )
        }

        Text(
            text = "Typography & Labels",
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary
        )

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "Primary Label (High Emphasis)",
                style = LemmaTheme.typography.bodyLarge,
                color = LemmaTheme.colors.textPrimary
            )
            Text(
                text = "Secondary Label (Medium Emphasis)",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary
            )
            Text(
                text = "Tertiary Label (Low Emphasis)",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textTertiary
            )
            Text(
                text = "Quaternary Label (Muted)",
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textQuaternary
            )
        }

        Text(
            text = "Buttons",
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            LemmaButton(
                text = "Primary",
                variant = LemmaButtonVariant.Primary,
                onClick = {}
            )
            LemmaButton(
                text = "Secondary",
                variant = LemmaButtonVariant.Secondary,
                onClick = {}
            )
            LemmaButton(
                text = "Ghost",
                variant = LemmaButtonVariant.Ghost,
                onClick = {}
            )
        }

        Text(
            text = "Chat Bubbles",
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary
        )

        LemmaBubble(
            text = "Hello Lemma! Can you explain the KMP architecture?",
            role = LemmaBubbleRole.User,
            modifier = Modifier.align(Alignment.End)
        )

        LemmaBubble(
            text = "Certainly! Lemma's mobile client is built with Compose Multiplatform sharing UI and state logic.",
            role = LemmaBubbleRole.Assistant,
            modifier = Modifier.align(Alignment.Start)
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Input Bar",
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary
        )

        LemmaInput(
            value = inputText,
            onValueChange = { inputText = it },
            onSend = { inputText = "" }
        )
    }
}
