package dev.lemmahq.lemma.ui.conversation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import dev.lemmahq.lemma.client.ClientConversation
import dev.lemmahq.lemma.client.ClientProvider

internal class ConversationState {
    val conversations = mutableStateListOf<ClientConversation>()
    var currentConversation by mutableStateOf<ClientConversation?>(null)
    val messages = mutableStateListOf<UiMessage>()
    var hasOlderMessages by mutableStateOf(false)
    var isLoadingOlderMessages by mutableStateOf(false)
    var inputText by mutableStateOf("")
    var isStreaming by mutableStateOf(false)
    var streamingMessageId by mutableStateOf<String?>(null)
    var isLoadingConversations by mutableStateOf(false)
    var providers by mutableStateOf<List<ClientProvider>>(emptyList())
    var providersLoaded by mutableStateOf(false)
    var selectedProviderId by mutableStateOf("")
    var selectedModel by mutableStateOf("")
    var showModelPicker by mutableStateOf(false)
    var bannerErrorMessage by mutableStateOf<String?>(null)
    var lastFailedText by mutableStateOf<String?>(null)
}

@Composable
internal fun rememberConversationState(): ConversationState = remember { ConversationState() }
