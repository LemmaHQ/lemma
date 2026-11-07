package dev.lemmahq.lemma.ui.session

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaCode
import dev.lemmahq.lemma.ui.components.LemmaCopyButton
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_tool_show_all
import lemma.mobile.shared.generated.resources.agent_tool_show_less
import org.jetbrains.compose.resources.stringResource

private val CODE_CAP = 220.dp
private val CODE_CAP_SLACK = 24.dp
private val FADE_HEIGHT = 56.dp

@OptIn(ExperimentalSerializationApi::class)
private val prettyJson = Json {
    prettyPrint = true
    prettyPrintIndent = "  "
}

/**
 * A tool call's [text] under its [label] with a button that copies it; JSON is indented. Text
 * taller than the cap shows its top under a fade, with a button that shows all of it.
 */
@Composable
internal fun ToolCallSection(label: String, copyLabel: String, text: String) {
    val shown = remember(text) { indentJson(text) }
    var showAll by rememberSaveable { mutableStateOf(false) }
    var fullHeight by remember { mutableIntStateOf(0) }
    val capped = fullHeight > with(LocalDensity.current) { (CODE_CAP + CODE_CAP_SLACK).roundToPx() }
    val clipped = capped && !showAll
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = LemmaTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = LemmaTheme.colors.textSecondary,
                modifier = Modifier.weight(1f),
            )
            LemmaCopyButton(text = shown, label = copyLabel, iconSize = 14.dp)
        }
        Box(
            modifier =
                Modifier.fillMaxWidth()
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.fill1)
                    .animateContentSize()
                    .then(if (clipped) Modifier.height(CODE_CAP) else Modifier)
                    .clipToBounds()
        ) {
            LemmaCode(
                code = shown,
                language = "json",
                modifier =
                    Modifier.fillMaxWidth()
                        .wrapContentHeight(Alignment.Top, unbounded = true)
                        .onSizeChanged { fullHeight = it.height },
            )
            if (clipped) CodeFade(Modifier.align(Alignment.BottomCenter))
        }
        if (capped) ShowAllToggle(showAll = showAll, onToggle = { showAll = !showAll })
    }
}

@Composable
private fun CodeFade(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(FADE_HEIGHT)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.Transparent,
                            LemmaTheme.colors.fill1.compositeOver(LemmaTheme.colors.background),
                        )
                    )
                )
    )
}

@Composable
private fun ShowAllToggle(showAll: Boolean, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    Text(
        text =
            stringResource(
                if (showAll) Res.string.agent_tool_show_less else Res.string.agent_tool_show_all
            ),
        style = LemmaTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
        color = LemmaTheme.colors.textSecondary,
        modifier =
            modifier
                .heightIn(min = 40.dp)
                .clickable(role = Role.Button, onClick = onToggle)
                .wrapContentHeight(Alignment.CenterVertically)
                .padding(end = 12.dp),
    )
}

/** [text] indented as JSON when it holds an object or array; other text as it is. */
internal fun indentJson(text: String): String {
    val trimmed = text.trim()
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text
    return try {
        prettyJson.encodeToString(JsonElement.serializer(), Json.parseToJsonElement(trimmed))
    } catch (_: SerializationException) {
        text
    }
}
