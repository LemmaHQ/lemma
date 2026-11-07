package dev.lemmahq.lemma.ui.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.auth_fields_required
import lemma.mobile.shared.generated.resources.auth_password_mismatch

/** Which form the auth screen shows: the two sign-in steps, or sign-up. */
enum class AuthStep {
    Account,
    Password,
    SignUp,
}

/**
 * Signs in or up through [client]; success stores the token pair, which moves the app past sign-in.
 * Sign-in first checks the account: a known one asks for its password, and an unknown one continues
 * at sign-up with the account as its email or username.
 */
class AuthViewModel(private val client: LemmaClient) : ViewModel() {

    var step by mutableStateOf(AuthStep.Account)
        private set

    /** The email or username signing in. */
    var identifier by mutableStateOf("")
        private set

    var username by mutableStateOf("")
        private set

    var email by mutableStateOf("")
        private set

    var password by mutableStateOf("")
        private set

    var confirmation by mutableStateOf("")
        private set

    var busy by mutableStateOf(false)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    /** Release version of the server or engine; null until it answers. */
    var serverVersion by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            try {
                serverVersion = client.getVersion()
            } catch (_: ServiceException) {}
        }
    }

    fun changeIdentifier(value: String) {
        identifier = value
        error = null
    }

    fun changeUsername(value: String) {
        username = value
        error = null
    }

    fun changeEmail(value: String) {
        email = value
        error = null
    }

    fun changePassword(value: String) {
        password = value
        error = null
    }

    fun changeConfirmation(value: String) {
        confirmation = value
        error = null
    }

    /** Returns to the account step from the password step or from sign-up. */
    fun back() {
        show(AuthStep.Account)
    }

    fun showSignUp() {
        username = ""
        email = ""
        show(AuthStep.SignUp)
    }

    fun submit() {
        val account = identifier.trim()
        when {
            step == AuthStep.Account && account.isEmpty() -> requireFields()
            step == AuthStep.Account -> request { checkAccount(account) }
            step == AuthStep.Password && password.isEmpty() -> requireFields()
            step == AuthStep.Password -> request { client.signIn(account, password) }
            username.isBlank() || email.isBlank() || password.isEmpty() -> requireFields()
            password != confirmation -> error = UiText.Resource(Res.string.auth_password_mismatch)
            else -> request { client.signUp(username.trim(), email.trim(), password) }
        }
    }

    private suspend fun checkAccount(account: String) {
        if (client.checkAccount(account)) {
            show(AuthStep.Password)
        } else {
            username = if ('@' in account) "" else account
            email = if ('@' in account) account else ""
            show(AuthStep.SignUp)
        }
    }

    private fun show(next: AuthStep) {
        step = next
        password = ""
        confirmation = ""
        error = null
    }

    private fun requireFields() {
        error = UiText.Resource(Res.string.auth_fields_required)
    }

    private fun request(call: suspend () -> Unit) {
        busy = true
        error = null
        viewModelScope.launch {
            try {
                call()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                busy = false
            }
        }
    }
}
