package dev.lemmahq.lemma.ui.auth

import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.auth_fields_required
import lemma.mobile.shared.generated.resources.auth_password_mismatch

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    private val client = FakeLemmaClient()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(): AuthViewModel =
        AuthViewModel(client).also {
            advanceUntilIdle()
            client.calls.clear()
        }

    private fun TestScope.submit(viewModel: AuthViewModel) {
        viewModel.submit()
        advanceUntilIdle()
    }

    @Test
    fun theServerVersionLoadsAndAnUnreachableServerShowsNone() = runTest {
        assertEquals("1.0.0", viewModel().serverVersion)

        client.onGetVersion = { throw ServiceException(ServiceFailure.Network) }
        assertNull(viewModel().serverVersion)
    }

    @Test
    fun aKnownAccountContinuesToItsPassword() = runTest {
        val viewModel = viewModel()
        viewModel.changeIdentifier("  ada@example.com ")

        submit(viewModel)
        assertEquals(AuthStep.Password, viewModel.step)

        viewModel.changePassword("password-1")
        submit(viewModel)

        assertEquals(
            listOf(
                Call("checkAccount", "ada@example.com"),
                Call("signIn", "ada@example.com", "password-1"),
            ),
            client.calls,
        )
        assertFalse(viewModel.busy)
    }

    @Test
    fun anUnknownAccountContinuesAtSignUpWithItPrefilled() = runTest {
        client.onCheckAccount = { false }
        val viewModel = viewModel()

        viewModel.changeIdentifier("ada@example.com")
        submit(viewModel)
        assertEquals(AuthStep.SignUp, viewModel.step)
        assertEquals("" to "ada@example.com", viewModel.username to viewModel.email)

        viewModel.back()
        viewModel.changeIdentifier("ada")
        submit(viewModel)
        assertEquals("ada" to "", viewModel.username to viewModel.email)
    }

    @Test
    fun changingTheAccountReturnsToTheFirstStepWithoutThePassword() = runTest {
        val viewModel = viewModel()
        viewModel.changeIdentifier("ada")
        submit(viewModel)
        viewModel.changePassword("password-1")

        viewModel.back()

        assertEquals(AuthStep.Account, viewModel.step)
        assertEquals("ada", viewModel.identifier)
        assertEquals("", viewModel.password)
    }

    @Test
    fun signingUpNeedsAllFieldsAndAMatchingConfirmation() = runTest {
        val viewModel = viewModel()
        viewModel.showSignUp()
        viewModel.changeUsername("ada")
        viewModel.changeEmail("ada@example.com")
        viewModel.changePassword("password-1")

        submit(viewModel)
        assertEquals(UiText.Resource(Res.string.auth_password_mismatch), viewModel.error)

        viewModel.changeConfirmation("password-1")
        assertNull(viewModel.error)
        submit(viewModel)

        assertEquals(listOf(Call("signUp", "ada", "ada@example.com", "password-1")), client.calls)
    }

    @Test
    fun blankFieldsAreRejectedWithoutACall() = runTest {
        val viewModel = viewModel()
        val required = UiText.Resource(Res.string.auth_fields_required)

        viewModel.changeIdentifier("   ")
        submit(viewModel)
        assertEquals(required, viewModel.error)

        viewModel.changeIdentifier("ada")
        submit(viewModel)
        client.calls.clear()
        submit(viewModel)
        assertEquals(required, viewModel.error)

        viewModel.showSignUp()
        viewModel.changeEmail("ada@example.com")
        submit(viewModel)
        assertEquals(required, viewModel.error)
        viewModel.changeUsername("ada")
        viewModel.changeEmail(" ")
        submit(viewModel)
        assertEquals(required, viewModel.error)
        viewModel.changeEmail("ada@example.com")
        submit(viewModel)
        assertEquals(required, viewModel.error)
        assertEquals(emptyList(), client.calls)
    }

    @Test
    fun aRejectedSignInShowsTheReasonAndCanBeResent() = runTest {
        client.onSignIn = { _, _ -> throw ServiceException(ServiceFailure.CredentialsInvalid) }
        val viewModel = viewModel()
        viewModel.changeIdentifier("ada")
        submit(viewModel)
        viewModel.changePassword("wrong-password")

        submit(viewModel)

        assertEquals(errorText(ServiceFailure.CredentialsInvalid), viewModel.error)
        assertFalse(viewModel.busy)
        assertEquals(AuthStep.Password, viewModel.step)
        client.onSignIn = { _, _ -> }
        viewModel.changePassword("password-1")
        submit(viewModel)
        assertNull(viewModel.error)
        assertEquals(Call("signIn", "ada", "password-1"), client.calls.last())
    }
}
