package com.lemmaos.lemma

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.lemmaos.lemma.data.ConversationRepository
import com.lemmaos.lemma.data.ServerConfigStore
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.data.createAuthRepository
import com.lemmaos.lemma.data.createConversationRepository
import com.lemmaos.lemma.ui.LemmaTheme
import com.lemmaos.lemma.ui.auth.AuthViewModel
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
        val repository = remember(serverUrl) { createAuthRepository(serverConfig, session) }
        val viewModel = remember(repository) { AuthViewModel(repository) }
        val state by viewModel.state.collectAsState()
        LaunchedEffect(repository) { viewModel.bootstrap() }

        when {
            !state.ready -> LoadingScreen()
            state.user == null -> LoginScreen(viewModel)
            else -> MainContent(
                session = session,
                serverConfig = serverConfig,
                onLogout = viewModel::logout,
            )
        }
    }
}

@Composable
private fun MainContent(
    session: SessionStore,
    serverConfig: ServerConfigStore,
    onLogout: () -> Unit,
) {
    val conversationRepository = remember(session) {
        createConversationRepository(serverConfig, session)
    }
    val conversationsViewModel = remember(conversationRepository) {
        ConversationsViewModel(conversationRepository)
    }
    LaunchedEffect(conversationRepository) { conversationsViewModel.refresh() }

    ConversationsScreen(
        conversationsViewModel = conversationsViewModel,
        onLogout = onLogout,
    )
}

@Composable
private fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
