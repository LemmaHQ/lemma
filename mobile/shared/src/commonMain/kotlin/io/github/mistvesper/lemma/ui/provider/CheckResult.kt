package io.github.mistvesper.lemma.ui.provider

import io.github.mistvesper.lemma.i18n.UiText

/** The state of one connectivity check. */
internal sealed interface CheckResult {
    data object Checking : CheckResult

    data object Passed : CheckResult

    data class Failed(val message: UiText) : CheckResult
}
