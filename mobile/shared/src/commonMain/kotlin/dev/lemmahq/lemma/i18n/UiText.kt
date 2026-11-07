package dev.lemmahq.lemma.i18n

import androidx.compose.runtime.Composable
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

/** Text a view model hands the UI, resolved against the current locale where it is shown. */
sealed interface UiText {

    @Composable fun text(): String

    /** A string resource formatted with [args]. */
    data class Resource(val resource: StringResource, val args: List<Any> = emptyList()) : UiText {
        @Suppress("SpreadOperator")
        @Composable
        override fun text(): String = stringResource(resource, *args.toTypedArray())
    }

    /** Text shown as received, such as an upstream failure message. */
    data class Raw(val text: String) : UiText {
        @Composable override fun text(): String = text
    }
}
