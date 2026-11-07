package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.error_provider_fields_required
import lemma.mobile.shared.generated.resources.provider_identifier_invalid

@OptIn(ExperimentalCoroutinesApi::class)
class NewProviderViewModelTest {

    private val client = FakeLemmaClient()
    private val created = mutableListOf<ClientProvider>()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = NewProviderViewModel(client) { created += it }

    @Test
    fun theProviderIdMustBePrintableAscii() = runTest {
        val viewModel = viewModel()
        viewModel.baseUrl = "https://api.example.com"

        for (identifier in listOf("", "  ", "我的服务商", "tab\there")) {
            viewModel.identifier = identifier
            viewModel.save()
            assertEquals(UiText.Resource(Res.string.provider_identifier_invalid), viewModel.error)
        }
        advanceUntilIdle()

        assertEquals(emptyList(), client.calls)
    }

    @Test
    fun theBaseUrlIsRequiredAndMustUseHttp() = runTest {
        val viewModel = viewModel()
        viewModel.identifier = "My Proxy_1"

        viewModel.save()
        assertEquals(UiText.Resource(Res.string.error_provider_fields_required), viewModel.error)
        viewModel.baseUrl = "ftp://files.example.com"
        viewModel.save()
        advanceUntilIdle()

        assertEquals(true, viewModel.baseUrlInvalid)
        assertEquals(emptyList(), client.calls)
    }

    @Test
    fun savingSendsTheTrimmedFormAndNamesTheProviderAfterItsId() = runTest {
        val stored = sampleProvider("proxy")
        client.onCreateProvider = { stored }
        val viewModel = viewModel()
        viewModel.kind = "anthropic"
        viewModel.identifier = " my proxy "
        viewModel.name = "  "
        viewModel.apiKey = " sk-1 "
        viewModel.baseUrl = " https://api.example.com "
        viewModel.apiPath = " /v1/messages "

        viewModel.save()
        advanceUntilIdle()

        val input =
            ClientProviderInput(
                kind = "anthropic",
                identifier = "my proxy",
                name = "my proxy",
                baseUrl = "https://api.example.com",
                apiKey = "sk-1",
                apiPath = "/v1/messages",
            )
        assertEquals(listOf(Call("createProvider", input)), client.calls)
        assertEquals(listOf(stored), created)
        assertEquals(stored, viewModel.created)
    }

    @Test
    fun aNamedProviderKeepsItsNameAndSavesOnce() = runTest {
        val viewModel = viewModel()
        viewModel.identifier = "proxy"
        viewModel.name = " Proxy "
        viewModel.baseUrl = "https://api.example.com"

        viewModel.save()
        viewModel.save()
        advanceUntilIdle()

        val input =
            ClientProviderInput(
                kind = "openai",
                identifier = "proxy",
                name = "Proxy",
                baseUrl = "https://api.example.com",
                apiKey = "",
                apiPath = "",
            )
        assertEquals(listOf(Call("createProvider", input)), client.calls)
    }

    @Test
    fun aRejectedProviderStaysOnTheForm() = runTest {
        client.onCreateProvider = { throw ServiceException(ServiceFailure.ProviderIdentifierTaken) }
        val viewModel = viewModel()
        viewModel.identifier = "openai"
        viewModel.baseUrl = "https://api.example.com/v1"

        viewModel.save()
        advanceUntilIdle()

        assertEquals(errorText(ServiceFailure.ProviderIdentifierTaken), viewModel.error)
        assertNull(viewModel.created)
        assertEquals(emptyList(), created)
    }
}
