package com.lemmaos.lemma

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.lemmaos.lemma.data.AppContainer
import com.lemmaos.lemma.data.ServerConfigStore
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.data.createAppContainer
import com.lemmaos.lemma.data.createAuthRepository
import com.lemmaos.lemma.ui.LemmaTheme
import com.lemmaos.lemma.ui.auth.AuthViewModel
import com.lemmaos.lemma.ui.providers.ProvidersViewModel
import com.lemmaos.lemma.ui.chat.ChatViewModel
import com.lemmaos.lemma.ui.conversations.ConversationsViewModel
import com.lemmaos.lemma.ui.screens.ConversationsScreen
import com.lemmaos.lemma.ui.chat.ModelChoice
import com.lemmaos.lemma.i18n.I18n
import com.lemmaos.lemma.i18n.Language
import com.lemmaos.lemma.ui.screens.ProvidersScreen
import com.lemmaos.lemma.ui.screens.StorageScreen
import com.lemmaos.lemma.ui.storage.StorageViewModel
import com.lemmaos.lemma.ui.screens.LoginScreen
import com.lemmaos.lemma.ui.screens.ServerUrlScreen

@Composable
fun App() {
    LemmaTheme {
        val serverConfig = remember { ServerConfigStore() }
        var serverUrl by remember { mutableStateOf(serverConfig.serverUrl) }
        if (serverUrl == null) {
            ServerUrlScreen(
                store = serverConfig,
                onContinue = { serverUrl = serverConfig.serverUrl },
            )
            return@LemmaTheme
        }

        val session = remember { SessionStore() }
        val authViewModel = remember(serverUrl) {
            AuthViewModel(createAuthRepository(serverConfig, session))
        }
        val authState by authViewModel.state.collectAsState()
        LaunchedEffect(serverUrl) { authViewModel.bootstrap() }

        var container by remember { mutableStateOf<AppContainer?>(null) }
        var languageTick by remember { mutableStateOf(0) }

        when {
            !authState.ready -> LoadingScreen()
            authState.user == null -> LoginScreen(
                viewModel = authViewModel,
                onToggleLanguage = {
                    I18n.setLanguage(
                        if (I18n.current == Language.EN) Language.ZH else Language.EN,
                    )
                    languageTick += 1
                },
            )
            else -> {
                val user = authState.user!!
                if (container == null) {
                    container = createAppContainer(serverConfig, session, user.id)
                }
                MainContent(
                    container = container!!,
                    onLogout = {
                        container?.stopSync()
                        container = null
                        authViewModel.logout()
                    },
                )
            }
        }
    }
}

@Composable
private fun MainContent(
    container: AppContainer,
    onLogout: () -> Unit,
) {
    val conversationsViewModel = remember(container) {
        ConversationsViewModel(container.conversationRepository)
    }
    val chatViewModel = remember(container) { ChatViewModel(container.chatRepository) }
    val providersViewModel = remember(container) {
        ProvidersViewModel(container.providerRepository)
    }
    var modelChoice by remember(container) { mutableStateOf<ModelChoice?>(null) }

    LaunchedEffect(container) {
        container.startSync()
        conversationsViewModel.refresh()
        providersViewModel.refresh()
    }
    DisposableEffect(container) {
        onDispose { container.stopSync() }
    }
    var settingsSection by remember { mutableStateOf<String?>(null) }
    when (settingsSection) {
        "providers" -> {
            ProvidersScreen(
                viewModel = providersViewModel,
                onBack = { settingsSection = null },
            )
        }
        "storage" -> {
            val storageViewModel = remember(container) {
                StorageViewModel(container.storageRepository)
            }
            LaunchedEffect(container) { storageViewModel.refresh() }
            StorageScreen(
                viewModel = storageViewModel,
                onBack = { settingsSection = null },
            )
        }
        else -> {
            val providers by providersViewModel.list.collectAsState()
            ConversationsScreen(
                conversationsViewModel = conversationsViewModel,
                chatViewModel = chatViewModel,
                providers = providers,
                modelChoice = modelChoice,
                onSelectModel = { modelChoice = it },
                onLogout = onLogout,
                onOpenProviders = { settingsSection = "providers" },
                onOpenStorage = { settingsSection = "storage" },
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
