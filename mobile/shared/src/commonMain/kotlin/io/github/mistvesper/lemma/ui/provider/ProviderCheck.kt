package io.github.mistvesper.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.github.mistvesper.lemma.client.ClientProvider
import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.i18n.errorText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Connectivity check state for one provider, discarding stale results when inputs or selection
 * change.
 */
internal class ProviderCheck(
    private val client: LemmaClient,
    private val scope: CoroutineScope,
    private val provider: () -> ClientProvider,
    private val pickedModel: () -> String?,
    private val canCheck: () -> Boolean,
    private val checkKey: () -> String,
) {
    private var checked by mutableStateOf<Pair<String, CheckResult>?>(null)

    val model: String?
        get() {
            val available = provider().source.models
            return pickedModel()?.takeIf { picked -> available.any { it.id == picked } }
                ?: available.firstOrNull()?.id
        }

    val result: CheckResult?
        get() = checked?.takeIf { it.first == fullKey(model) }?.second

    fun run() {
        if (!canCheck()) return
        val targetModel = model ?: return
        val key = fullKey(targetModel)
        val pending = key to CheckResult.Checking
        checked = pending
        scope.launch {
            val outcome =
                try {
                    val failure = client.checkProvider(provider().id, targetModel)
                    if (failure.isEmpty()) CheckResult.Passed
                    else CheckResult.Failed(UiText.Raw(failure))
                } catch (e: ServiceException) {
                    CheckResult.Failed(errorText(e.failure))
                }
            if (checked == pending) checked = key to outcome
        }
    }

    fun clear() {
        checked = null
    }

    private fun fullKey(model: String?): String = "${checkKey()}\n$model"
}
