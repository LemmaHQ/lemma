package io.github.mistvesper.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme

private const val MAX_HEIGHT_FRACTION = 0.76f

/**
 * A modal sheet rising from the bottom edge, at most 76% of the window tall, with a drag handle and
 * an optional [title] above [content]. Opening it hides the soft keyboard; dragging it down,
 * tapping the scrim, or a back press calls [onDismiss].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LemmaBottomSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    SideEffect(Unit) { keyboard?.hide() }
    val maxHeight =
        with(LocalDensity.current) {
            (LocalWindowInfo.current.containerSize.height * MAX_HEIGHT_FRACTION).toDp()
        }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier.heightIn(max = maxHeight),
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        shape =
            LemmaTheme.shapes.lg.copy(
                bottomStart = CornerSize(0.dp),
                bottomEnd = CornerSize(0.dp),
            ),
        containerColor = LemmaTheme.colors.background,
        contentColor = LemmaTheme.colors.foreground,
        tonalElevation = 0.dp,
        scrimColor = LemmaTheme.colors.scrim,
        dragHandle = {
            BottomSheetDefaults.DragHandle(
                width = 36.dp,
                height = 4.dp,
                color = LemmaTheme.colors.input,
            )
        },
    ) {
        title?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.title,
                color = LemmaTheme.colors.foreground,
                modifier =
                    Modifier.padding(start = 16.dp, end = 16.dp, bottom = 10.dp).semantics {
                        heading()
                    },
            )
            Box(
                modifier = Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.border)
            )
        }
        Column(
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 24.dp),
            content = content,
        )
    }
}
