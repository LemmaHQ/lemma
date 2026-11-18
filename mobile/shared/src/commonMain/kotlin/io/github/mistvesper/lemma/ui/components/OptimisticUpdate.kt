package io.github.mistvesper.lemma.ui.components

import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.i18n.errorText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Applies [apply] immediately, runs [commit] in this scope, and calls [revert] with the service
 * error text if [commit] fails with [ServiceException].
 */
internal fun CoroutineScope.runOptimistic(
    apply: () -> Unit,
    commit: suspend () -> Unit,
    revert: () -> Unit,
    onError: (UiText?) -> Unit,
) {
    apply()
    onError(null)
    launch {
        try {
            commit()
        } catch (e: ServiceException) {
            revert()
            onError(errorText(e.failure))
        }
    }
}
