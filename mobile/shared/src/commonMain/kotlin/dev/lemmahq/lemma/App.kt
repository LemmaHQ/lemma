package dev.lemmahq.lemma

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.RemoteLemmaClient
import dev.lemmahq.lemma.data.DefaultSettingsRepository
import dev.lemmahq.lemma.data.InMemoryLocalChatRepository
import dev.lemmahq.lemma.data.LocalChatRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.auth.AuthScreen
import dev.lemmahq.lemma.ui.chat.MainChatScreen
import dev.lemmahq.lemma.ui.provider.ProvidersScreen
import dev.lemmahq.lemma.ui.setup.SetupScreen

@Composable
fun App(
    localChatRepository: LocalChatRepository = remember { InMemoryLocalChatRepository() },
    localClientFactory: (suspend (SettingsRepository) -> LemmaClient)? = null,
) {
    val settingsRepository = remember { DefaultSettingsRepository() }
    var appMode by remember {
        mutableStateOf(
            settingsRepository.getAppMode()
                ?: settingsRepository.getServerUrl()?.let { DefaultSettingsRepository.MODE_REMOTE }
        )
    }
    var currentServerUrl by remember { mutableStateOf(settingsRepository.getServerUrl()) }
    var currentAccessToken by remember { mutableStateOf(settingsRepository.getAccessToken()) }
    val themeMode = remember { settingsRepository.getThemeMode() }
    val isDark =
        when (themeMode) {
            DefaultSettingsRepository.THEME_DARK -> true
            DefaultSettingsRepository.THEME_LIGHT -> false
            else -> isSystemInDarkTheme()
        }
    var showProviders by remember { mutableStateOf(false) }
    var providersNonce by remember { mutableStateOf(0) }

    val client by
        produceState<LemmaClient?>(null, appMode, currentServerUrl) {
            value =
                when {
                    appMode == DefaultSettingsRepository.MODE_REMOTE &&
                        !currentServerUrl.isNullOrBlank() ->
                        RemoteLemmaClient(
                            LemmaRpcClient(
                                host = currentServerUrl.orEmpty(),
                                tokenProvider = { settingsRepository.getAccessToken() },
                                settingsRepository = settingsRepository,
                            ),
                            settingsRepository,
                        )
                    appMode == DefaultSettingsRepository.MODE_LOCAL && localClientFactory != null ->
                        localClientFactory.invoke(settingsRepository)
                    else -> null
                }
        }

    LemmaTheme(darkTheme = isDark) {
        Box(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
            when {
                appMode.isNullOrBlank() -> {
                    SetupScreen(
                        settingsRepository = settingsRepository,
                        localAvailable = localClientFactory != null,
                        onConnected = { url ->
                            settingsRepository.setAppMode(DefaultSettingsRepository.MODE_REMOTE)
                            currentServerUrl = url
                            appMode = DefaultSettingsRepository.MODE_REMOTE
                        },
                        onLocalSelected = {
                            settingsRepository.setAppMode(DefaultSettingsRepository.MODE_LOCAL)
                            appMode = DefaultSettingsRepository.MODE_LOCAL
                        },
                    )
                }
                currentAccessToken.isNullOrBlank() -> {
                    val ready = client
                    if (ready == null) {
                        LoadingIndicator()
                    } else {
                        AuthScreen(
                            client = ready,
                            connectionLabel =
                                if (appMode == DefaultSettingsRepository.MODE_LOCAL) {
                                    "Running locally on this device"
                                } else {
                                    "Connected to $currentServerUrl"
                                },
                            showSkip = appMode == DefaultSettingsRepository.MODE_LOCAL,
                            onAuthSuccess = {
                                currentAccessToken = settingsRepository.getAccessToken()
                            },
                            onChangeMode = {
                                settingsRepository.clearAuth()
                                settingsRepository.setAppMode(null)
                                settingsRepository.setServerUrl(null)
                                appMode = null
                                currentServerUrl = null
                                currentAccessToken = null
                            },
                        )
                    }
                }
                else -> {
                    val ready = client
                    if (ready == null) {
                        LoadingIndicator()
                    } else if (showProviders) {
                        ProvidersScreen(
                            client = ready,
                            onBack = {
                                showProviders = false
                                providersNonce++
                            },
                        )
                    } else {
                        key(providersNonce) {
                            MainChatScreen(
                                client = ready,
                                settingsRepository = settingsRepository,
                                onLogout = {
                                    settingsRepository.clearAuth()
                                    currentAccessToken = null
                                },
                                onManageProviders = { showProviders = true },
                                localChatRepository = localChatRepository,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingIndicator() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = LemmaTheme.colors.primary)
    }
}
