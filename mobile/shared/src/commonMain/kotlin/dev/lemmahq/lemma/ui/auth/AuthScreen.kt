package dev.lemmahq.lemma.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.loginRequest
import dev.lemmahq.gen.lemma.v1.signUpRequest
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaTextField
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    serverUrl: String,
    settingsRepository: SettingsRepository,
    onAuthSuccess: () -> Unit,
    onChangeServer: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isLoginMode by remember { mutableStateOf(true) }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val rpcClient = remember(serverUrl) {
        LemmaRpcClient(
            host = serverUrl,
            tokenProvider = { settingsRepository.getAccessToken() }
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LemmaTheme.colors.background)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = if (isLoginMode) "Sign In" else "Create Account",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Connected to $serverUrl",
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary
            )

            Spacer(modifier = Modifier.height(24.dp))

            if (!isLoginMode) {
                LemmaTextField(
                    value = username,
                    onValueChange = {
                        username = it
                        errorMessage = null
                    },
                    placeholder = "Username",
                    enabled = !isLoading
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            LemmaTextField(
                value = email,
                onValueChange = {
                    email = it
                    errorMessage = null
                },
                placeholder = if (isLoginMode) "Username or Email" else "Email",
                enabled = !isLoading
            )

            Spacer(modifier = Modifier.height(12.dp))

            LemmaTextField(
                value = password,
                onValueChange = {
                    password = it
                    errorMessage = null
                },
                placeholder = "Password",
                enabled = !isLoading
            )

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = errorMessage.orEmpty(),
                    style = LemmaTheme.typography.labelSmall,
                    color = LemmaTheme.colors.danger,
                    modifier = Modifier.align(Alignment.Start)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            if (isLoading) {
                CircularProgressIndicator(
                    color = LemmaTheme.colors.primary,
                    modifier = Modifier.size(28.dp)
                )
            } else {
                LemmaButton(
                    text = if (isLoginMode) "Sign In" else "Sign Up",
                    onClick = {
                        if (email.isBlank() || password.isBlank() || (!isLoginMode && username.isBlank())) {
                            errorMessage = "Please fill in all required fields"
                            return@LemmaButton
                        }

                        isLoading = true
                        errorMessage = null

                        scope.launch {
                            try {
                                if (isLoginMode) {
                                    val req = loginRequest {
                                        if (email.contains("@")) {
                                            this.email = email.trim()
                                        } else {
                                            this.username = email.trim()
                                        }
                                        this.password = password
                                    }
                                    when (val response = rpcClient.auth.login(req, emptyMap())) {
                                        is ResponseMessage.Success -> {
                                            val res = response.message
                                            settingsRepository.setAccessToken(res.tokens.accessToken)
                                            settingsRepository.setRefreshToken(res.tokens.refreshToken)
                                            onAuthSuccess()
                                        }
                                        is ResponseMessage.Failure -> {
                                            errorMessage = response.cause.message ?: "Login failed"
                                        }
                                    }
                                } else {
                                    val req = signUpRequest {
                                        this.username = username.trim()
                                        this.email = email.trim()
                                        this.password = password
                                    }
                                    when (val response = rpcClient.auth.signUp(req, emptyMap())) {
                                        is ResponseMessage.Success -> {
                                            val res = response.message
                                            settingsRepository.setAccessToken(res.tokens.accessToken)
                                            settingsRepository.setRefreshToken(res.tokens.refreshToken)
                                            onAuthSuccess()
                                        }
                                        is ResponseMessage.Failure -> {
                                            errorMessage = response.cause.message ?: "Sign up failed"
                                        }
                                    }
                                }
                            } catch (e: Exception) {
                                errorMessage = e.message ?: "Authentication failed"
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    variant = LemmaButtonVariant.Primary
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isLoginMode) "No account? Sign up" else "Have an account? Sign in",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.primary,
                    modifier = Modifier.clickable {
                        isLoginMode = !isLoginMode
                        errorMessage = null
                    }
                )

                Text(
                    text = "Change server",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textTertiary,
                    modifier = Modifier.clickable {
                        onChangeServer()
                    }
                )
            }
        }
    }
}
