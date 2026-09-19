package dev.lemmahq.lemma.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.Conversation
import dev.lemmahq.gen.lemma.v1.createConversationRequest
import dev.lemmahq.gen.lemma.v1.listConversationsRequest
import dev.lemmahq.gen.lemma.v1.listMessagesRequest
import dev.lemmahq.gen.lemma.v1.listProvidersRequest
import dev.lemmahq.gen.lemma.v1.sendMessageRequest
import dev.lemmahq.lemma.data.InMemoryLocalChatRepository
import dev.lemmahq.lemma.data.LocalChatRepository
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.network.LemmaRpcClient
import dev.lemmahq.lemma.network.SyncCoordinator
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaBubble
import dev.lemmahq.lemma.ui.components.LemmaBubbleRole
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaInput
import kotlinx.coroutines.launch
data class UiMessage(
    val id: String,
    val role: LemmaBubbleRole,
    val text: String
)

@Composable
fun MainChatScreen(
    rpcClient: LemmaRpcClient,
    onLogout: () -> Unit,
    localChatRepository: LocalChatRepository = remember { InMemoryLocalChatRepository() },
    modifier: Modifier = Modifier
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val syncCoordinator = remember(rpcClient, localChatRepository) { SyncCoordinator(rpcClient, localChatRepository) }


    val conversations = remember { mutableStateListOf<Conversation>() }
    var currentConversation by remember { mutableStateOf<Conversation?>(null) }
    val messages = remember { mutableStateListOf<UiMessage>() }
    var inputText by remember { mutableStateOf("") }
    var isStreaming by remember { mutableStateOf(false) }
    var isLoadingConversations by remember { mutableStateOf(false) }

    var selectedProviderId by remember { mutableStateOf("") }
    var selectedModel by remember { mutableStateOf("") }
    var bannerErrorMessage by remember { mutableStateOf<String?>(null) }
    var lastFailedText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val cached = localChatRepository.getConversations()
        if (cached.isNotEmpty() && conversations.isEmpty()) {
            val restored = cached.map { c ->
                dev.lemmahq.gen.lemma.v1.conversation {
                    this.id = c.id
                    this.title = c.title
                }
            }
            conversations.addAll(restored)
            if (currentConversation == null) {
                currentConversation = restored.first()
            }
        }

        isLoadingConversations = true
        try {
            when (val provRes = rpcClient.provider.listProviders(listProvidersRequest {}, emptyMap())) {
                is ResponseMessage.Success -> {
                    val first = provRes.message.providersList.firstOrNull { it.enabled }
                    if (first != null) {
                        selectedProviderId = first.id
                        selectedModel = first.modelsList.firstOrNull().orEmpty()
                    }
                }
                is ResponseMessage.Failure -> {}
            }

            syncCoordinator.syncAll()

            val updatedCached = localChatRepository.getConversations()
            if (updatedCached.isNotEmpty()) {
                conversations.clear()
                val list = updatedCached.map { c ->
                    dev.lemmahq.gen.lemma.v1.conversation {
                        this.id = c.id
                        this.title = c.title
                    }
                }
                conversations.addAll(list)
                if (currentConversation == null) {
                    currentConversation = list.first()
                }
            }
        } finally {
            isLoadingConversations = false
        }
    }

    LaunchedEffect(currentConversation?.id) {
        val convId = currentConversation?.id ?: return@LaunchedEffect
        val cachedMsgs = localChatRepository.getMessages(convId)
        if (cachedMsgs.isNotEmpty()) {
            messages.clear()
            messages.addAll(cachedMsgs.map { m ->
                UiMessage(
                    id = m.id,
                    role = if (m.role == 1L) LemmaBubbleRole.User else LemmaBubbleRole.Assistant,
                    text = m.content
                )
            })
        } else {
            messages.clear()
        }

        when (val msgRes = rpcClient.conversation.listMessages(listMessagesRequest { conversationId = convId }, emptyMap())) {
            is ResponseMessage.Success -> {
                val serverMsgs = msgRes.message.messagesList
                val list = serverMsgs.map {
                    UiMessage(
                        id = it.id,
                        role = if (it.role == "user") LemmaBubbleRole.User else LemmaBubbleRole.Assistant,
                        text = it.content
                    )
                }
                messages.clear()
                messages.addAll(list)
                for (m in serverMsgs) {
                    localChatRepository.saveMessage(
                        id = m.id,
                        conversationId = convId,
                        role = if (m.role == "user") 1L else 2L,
                        content = m.content,
                        status = m.statusValue.toLong(),
                        createdAt = m.createdAt.seconds,
                        updatedAt = m.updatedAt.seconds
                    )
                }
            }
            is ResponseMessage.Failure -> {}
        }
    }

    LaunchedEffect(messages.size, messages.lastOrNull()?.text) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = LemmaTheme.colors.backgroundGroup,
                modifier = Modifier.width(280.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Conversations",
                        style = LemmaTheme.typography.titleLarge,
                        color = LemmaTheme.colors.textPrimary
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    LemmaButton(
                        text = "+ New Chat",
                        onClick = {
                            scope.launch {
                                drawerState.close()
                                when (val res = rpcClient.conversation.createConversation(createConversationRequest {}, emptyMap())) {
                                    is ResponseMessage.Success -> {
                                        conversations.add(0, res.message.conversation)
                                        currentConversation = res.message.conversation
                                        messages.clear()
                                    }
                                    is ResponseMessage.Failure -> {}
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        variant = LemmaButtonVariant.Primary
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    if (isLoadingConversations) {
                        CircularProgressIndicator(
                            color = LemmaTheme.colors.primary,
                            modifier = Modifier
                                .size(24.dp)
                                .align(Alignment.CenterHorizontally)
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            items(conversations, key = { it.id }) { conv ->
                                val isSelected = conv.id == currentConversation?.id
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(LemmaTheme.shapes.medium)
                                        .background(if (isSelected) LemmaTheme.colors.fill2 else LemmaTheme.colors.fill1)
                                        .clickable {
                                            currentConversation = conv
                                            scope.launch { drawerState.close() }
                                        }
                                        .padding(horizontal = 12.dp, vertical = 10.dp)
                                ) {
                                    Text(
                                        text = conv.title.ifBlank { "New Chat" },
                                        style = LemmaTheme.typography.bodyMedium,
                                        color = if (isSelected) LemmaTheme.colors.textPrimary else LemmaTheme.colors.textSecondary,
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    LemmaButton(
                        text = "Sign Out",
                        onClick = onLogout,
                        modifier = Modifier.fillMaxWidth(),
                        variant = LemmaButtonVariant.Secondary
                    )
                }
            }
        }
    ) {
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(LemmaTheme.colors.background)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable {
                        scope.launch { drawerState.open() }
                    }
                ) {
                    Text(
                        text = "☰",
                        style = LemmaTheme.typography.titleLarge,
                        color = LemmaTheme.colors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = currentConversation?.title?.ifBlank { "Lemma" } ?: "Lemma",
                        style = LemmaTheme.typography.titleMedium,
                        color = LemmaTheme.colors.textPrimary,
                        maxLines = 1
                    )
                }

                if (selectedModel.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .clip(LemmaTheme.shapes.full)
                            .background(LemmaTheme.colors.fill2)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = selectedModel,
                            style = LemmaTheme.typography.labelSmall,
                            color = LemmaTheme.colors.textSecondary
                        )
                    }
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(LemmaTheme.colors.separator)
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                if (messages.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Send a message to start chatting",
                            style = LemmaTheme.typography.bodyMedium,
                            color = LemmaTheme.colors.textTertiary
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            val isUser = msg.role == LemmaBubbleRole.User
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
                            ) {
                                LemmaBubble(
                                    text = msg.text,
                                    role = msg.role
                                )
                            }
                        }
                    }
                }
            }
            if (bannerErrorMessage != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(LemmaTheme.colors.danger.copy(alpha = 0.12f))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = bannerErrorMessage.orEmpty(),
                        style = LemmaTheme.typography.bodyMedium,
                        color = LemmaTheme.colors.danger,
                        modifier = Modifier.weight(1f)
                    )
                    if (lastFailedText != null && !isStreaming) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Retry",
                            style = LemmaTheme.typography.bodyMedium,
                            color = LemmaTheme.colors.primary,
                            modifier = Modifier.clickable {
                                inputText = lastFailedText.orEmpty()
                                bannerErrorMessage = null
                                lastFailedText = null
                            }
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "✕",
                        style = LemmaTheme.typography.bodyMedium,
                        color = LemmaTheme.colors.textSecondary,
                        modifier = Modifier.clickable {
                            bannerErrorMessage = null
                        }
                    )
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                LemmaInput(
                    value = inputText,
                    onValueChange = { inputText = it },
                    onSend = {
                        val text = inputText.trim()
                        if (text.isBlank() || isStreaming) return@LemmaInput
                        inputText = ""

                        scope.launch {
                            var conv = currentConversation
                            if (conv == null) {
                                when (val cRes = rpcClient.conversation.createConversation(createConversationRequest {}, emptyMap())) {
                                    is ResponseMessage.Success -> {
                                        conv = cRes.message.conversation
                                        currentConversation = conv
                                        conversations.add(0, conv)
                                    }
                                    is ResponseMessage.Failure -> return@launch
                                }
                            }

                            val userMsgId = "local_user_${messages.size}"
                            val aiMsgId = "local_ai_${messages.size + 1}"

                            messages.add(UiMessage(id = userMsgId, role = LemmaBubbleRole.User, text = text))
                            messages.add(UiMessage(id = aiMsgId, role = LemmaBubbleRole.Assistant, text = ""))
                            localChatRepository.saveMessage(
                                id = userMsgId,
                                conversationId = conv.id,
                                role = 1L,
                                content = text,
                                status = 0L,
                                createdAt = 0L,
                                updatedAt = 0L
                            )

                            isStreaming = true

                            try {
                                val stream = rpcClient.chat.sendMessage(emptyMap())
                                val req = sendMessageRequest {
                                    this.conversationId = conv.id
                                    this.content = text
                                    this.providerId = selectedProviderId
                                    this.model = selectedModel
                                    this.clientMsgId = userMsgId
                                }
                                stream.sendAndClose(req)
                                for (res in stream.responseChannel()) {
                                    val event = res.event
                                    if (event.hasDelta()) {
                                        val delta = event.delta.content
                                        val lastIdx = messages.indexOfLast { it.id == aiMsgId }
                                        if (lastIdx >= 0) {
                                            val old = messages[lastIdx]
                                            messages[lastIdx] = old.copy(text = old.text + delta)
                                        }
                                    } else if (event.hasDone()) {
                                        val lastIdx = messages.indexOfLast { it.id == aiMsgId }
                                        if (lastIdx >= 0) {
                                            val aiText = messages[lastIdx].text
                                            localChatRepository.saveMessage(
                                                id = aiMsgId,
                                                conversationId = conv.id,
                                                role = 2L,
                                                content = aiText,
                                                status = 2L,
                                                createdAt = 0L,
                                                updatedAt = 0L
                                            )
                                        }
                                        break
                                    } else if (event.hasError()) {
                                        val err = event.error.message
                                        val lastIdx = messages.indexOfLast { it.id == aiMsgId }
                                        if (lastIdx >= 0) {
                                            val old = messages[lastIdx]
                                            messages[lastIdx] = old.copy(text = old.text + "\n[Error: $err]")
                                        }
                                        break
                                    }
                                }
                            } catch (e: Exception) {
                                val formattedError = ErrorFormatter.format(e)
                                bannerErrorMessage = formattedError
                                lastFailedText = text
                                val lastIdx = messages.indexOfLast { it.id == aiMsgId }
                                if (lastIdx >= 0) {
                                    val old = messages[lastIdx]
                                    messages[lastIdx] = old.copy(text = old.text + if (old.text.isBlank()) "[Failed: $formattedError]" else "\n\n[Interrupted: $formattedError]")
                                }
                            } finally {
                                isStreaming = false
                            }
                        }
                    }
                )
            }
        }
    }
}
