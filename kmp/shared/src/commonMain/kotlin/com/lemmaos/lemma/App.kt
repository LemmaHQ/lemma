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
import com.lemmaos.lemma.ui.chat.ChatViewModel
import com.lemmaos.lemma.ui.conversations.ConversationsViewModel
import com.lemmaos.lemma.ui.screens.ConversationsScreen
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

        when {
            !authState.ready -> LoadingScreen()
            authState.user == null -> LoginScreen(authViewModel)
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

    LaunchedEffect(container) {
        container.startSync()
        conversationsViewModel.refresh()
    }
    DisposableEffect(container) {
        onDispose { container.stopSync() }
    }

    ConversationsScreen(
        conversationsViewModel = conversationsViewModel,
        chatViewModel = chatViewModel,
        onLogout = onLogout,
    )
}

@Composable
private fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
