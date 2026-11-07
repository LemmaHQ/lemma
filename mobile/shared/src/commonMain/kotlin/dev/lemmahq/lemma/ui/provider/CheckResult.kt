package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.i18n.UiText

/** The state of one connectivity check. */
internal sealed interface CheckResult {
    data object Checking : CheckResult

    data object Passed : CheckResult

    data class Failed(val message: UiText) : CheckResult
}
