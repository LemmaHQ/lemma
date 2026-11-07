package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import kotlin.test.Test
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LemmaDisclosureTest {

    @get:Rule val compose = createComposeRule()

    @Test
    fun screenReadersExpandAndCollapseTheContent() {
        compose.setContent {
            var expanded by rememberSaveable { mutableStateOf(false) }
            Box(modifier = Modifier.lemmaDisclosure(expanded) { expanded = !expanded }) {
                Text(if (expanded) "Hide details" else "Show details")
            }
        }

        compose.onNodeWithText("Show details").performSemanticsAction(SemanticsActions.Expand)
        compose.onNodeWithText("Hide details").performSemanticsAction(SemanticsActions.Collapse)
        compose.onNodeWithText("Show details").assertExists()
    }
}
