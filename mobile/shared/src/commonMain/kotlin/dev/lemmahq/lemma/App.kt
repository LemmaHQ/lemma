package dev.lemmahq.lemma

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import dev.lemmahq.lemma.data.DefaultSettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.auth.AuthScreen
import dev.lemmahq.lemma.ui.chat.MainChatScreen
import dev.lemmahq.lemma.ui.setup.SetupScreen

@Composable
fun App() {
    val settingsRepository = remember { DefaultSettingsRepository() }
    var currentServerUrl by remember { mutableStateOf(settingsRepository.getServerUrl()) }
    var currentAccessToken by remember { mutableStateOf(settingsRepository.getAccessToken()) }
    val isDark by remember { mutableStateOf(settingsRepository.getThemeMode() == DefaultSettingsRepository.THEME_DARK) }

    val rpcClient = remember(currentServerUrl, currentAccessToken) {
        if (!currentServerUrl.isNullOrBlank()) {
            LemmaRpcClient(
                host = currentServerUrl.orEmpty(),
                tokenProvider = { settingsRepository.getAccessToken() }
            )
        } else {
            null
        }
    }

    LemmaTheme(darkTheme = isDark) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding()
        ) {
            when {
                currentServerUrl.isNullOrBlank() -> {
                    SetupScreen(
                        settingsRepository = settingsRepository,
                        onConnected = { url ->
                            currentServerUrl = url
                        }
                    )
                }
                currentAccessToken.isNullOrBlank() -> {
                    AuthScreen(
                        serverUrl = currentServerUrl.orEmpty(),
                        settingsRepository = settingsRepository,
                        onAuthSuccess = {
                            currentAccessToken = settingsRepository.getAccessToken()
                        },
                        onChangeServer = {
                            settingsRepository.setServerUrl(null)
                            currentServerUrl = null
                        }
                    )
                }
                rpcClient != null -> {
                    MainChatScreen(
                        rpcClient = rpcClient,
                        onLogout = {
                            settingsRepository.clearAuth()
                            currentAccessToken = null
                        }
                    )
                }
            }
        }
    }
}
