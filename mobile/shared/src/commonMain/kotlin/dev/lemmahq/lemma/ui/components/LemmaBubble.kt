package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

enum class LemmaBubbleRole {
    User,
    Assistant
}

@Composable
fun LemmaBubble(
    text: String,
    role: LemmaBubbleRole,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when (role) {
        LemmaBubbleRole.User -> LemmaTheme.colors.userBubble
        LemmaBubbleRole.Assistant -> LemmaTheme.colors.assistantBubble
    }

    val textColor = when (role) {
        LemmaBubbleRole.User -> LemmaTheme.colors.userBubbleText
        LemmaBubbleRole.Assistant -> LemmaTheme.colors.assistantBubbleText
    }

    Box(
        modifier = modifier
            .clip(LemmaTheme.shapes.large)
            .background(backgroundColor)
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        Text(
            text = text,
            color = textColor,
            style = LemmaTheme.typography.bodyLarge
        )
    }
}
