package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.error_provider_fields_required
import lemma.mobile.shared.generated.resources.provider_identifier_invalid

private val IDENTIFIER_PATTERN = Regex("^[\\u0020-\\u007E]+$")

/**
 * The form that creates a provider. Saving needs a printable ASCII ID and an HTTP or HTTPS base
 * URL; a blank name saves the ID as the name. [onCreate] and [created] receive the stored provider.
 */
internal class NewProviderViewModel(
    private val client: LemmaClient,
    private val onCreate: (ClientProvider) -> Unit,
) : ViewModel() {

    var kind by mutableStateOf(PROVIDER_KINDS.first())
    var identifier by mutableStateOf("")
    var name by mutableStateOf("")
    var apiKey by mutableStateOf("")
    var baseUrl by mutableStateOf("")
    var apiPath by mutableStateOf("")

    var saving by mutableStateOf(false)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    /** The stored provider once saving succeeds, which opens its page. */
    var created by mutableStateOf<ClientProvider?>(null)
        private set

    /** Whether a base URL is filled in that is not an HTTP or HTTPS URL. */
    val baseUrlInvalid: Boolean
        get() = baseUrl.isNotBlank() && !isBaseUrlValid(baseUrl)

    fun save() {
        if (saving || baseUrlInvalid) return
        val id = identifier.trim()
        error =
            when {
                !IDENTIFIER_PATTERN.matches(id) ->
                    UiText.Resource(Res.string.provider_identifier_invalid)
                baseUrl.isBlank() -> UiText.Resource(Res.string.error_provider_fields_required)
                else -> null
            }
        if (error != null) return
        saving = true
        viewModelScope.launch {
            try {
                val provider =
                    client.createProvider(
                        ClientProviderInput(
                            kind = kind,
                            identifier = id,
                            name = name.trim().ifEmpty { id },
                            baseUrl = baseUrl.trim(),
                            apiKey = apiKey.trim(),
                            apiPath = apiPath.trim(),
                        )
                    )
                onCreate(provider)
                created = provider
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                saving = false
            }
        }
    }
}
