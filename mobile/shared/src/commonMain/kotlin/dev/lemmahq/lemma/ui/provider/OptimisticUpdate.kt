package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
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
