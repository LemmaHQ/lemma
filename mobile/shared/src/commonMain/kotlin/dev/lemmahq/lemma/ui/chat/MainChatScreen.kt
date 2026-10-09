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
import androidx.compose.ui.window.Dialog
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientConversation
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.InMemoryLocalChatRepository
import dev.lemmahq.lemma.data.LocalChatRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.ErrorFormatter
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
    client: LemmaClient,
    settingsRepository: SettingsRepository,
    onLogout: () -> Unit,
    onManageProviders: () -> Unit,
    localChatRepository: LocalChatRepository = remember { InMemoryLocalChatRepository() },
    modifier: Modifier = Modifier
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    val conversations = remember { mutableStateListOf<ClientConversation>() }
    var currentConversation by remember { mutableStateOf<ClientConversation?>(null) }
    val messages = remember { mutableStateListOf<UiMessage>() }
    var inputText by remember { mutableStateOf("") }
    var isStreaming by remember { mutableStateOf(false) }
    var isLoadingConversations by remember { mutableStateOf(false) }

    var providers by remember { mutableStateOf<List<ClientProvider>>(emptyList()) }
    var providersLoaded by remember { mutableStateOf(false) }
    var selectedProviderId by remember { mutableStateOf("") }
    var selectedModel by remember { mutableStateOf("") }
    var showModelPicker by remember { mutableStateOf(false) }
    var bannerErrorMessage by remember { mutableStateOf<String?>(null) }
    var lastFailedText by remember { mutableStateOf<String?>(null) }

    fun applyDefaultSelection(available: List<ClientProvider>) {
        val defaultProviderId = settingsRepository.getDefaultProviderId()
        val defaultModel = settingsRepository.getDefaultModel()
        val fromSettings = available.firstOrNull { it.id == defaultProviderId && it.enabled }
            ?.takeIf { defaultModel != null && it.models.contains(defaultModel) }
        if (fromSettings != null) {
            selectedProviderId = fromSettings.id
            selectedModel = defaultModel.orEmpty()
        } else {
            val first = available.firstOrNull { it.enabled }
            selectedProviderId = first?.id.orEmpty()
            selectedModel = first?.models?.firstOrNull().orEmpty()
        }
    }

    LaunchedEffect(Unit) {
        val cached = localChatRepository.getConversations()
        if (cached.isNotEmpty() && conversations.isEmpty()) {
            val restored = cached.map { c ->
                ClientConversation(id = c.id, title = c.title)
            }
            conversations.addAll(restored)
            if (currentConversation == null) {
                currentConversation = restored.first()
            }
        }

        isLoadingConversations = true
        try {
            val loaded = client.listProviders()
            providers = loaded
            applyDefaultSelection(loaded)
        } catch (e: Exception) {
            bannerErrorMessage = ErrorFormatter.format(e)
        } finally {
            isLoadingConversations = false
            providersLoaded = true
        }
    }

    LaunchedEffect(currentConversation?.id, providersLoaded) {
        if (!providersLoaded) return@LaunchedEffect
        val convId = currentConversation?.id
        if (convId == null) {
            messages.clear()
            return@LaunchedEffect
        }
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

        try {
            val serverMsgs = client.listMessages(convId)
            val list = serverMsgs.asReversed().map {
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
                    status = 2L,
                    createdAt = m.createdAtSeconds,
                    updatedAt = m.updatedAtSeconds
                )
            }
            val lastUsed = serverMsgs.firstOrNull { it.role == "assistant" && !it.model.isNullOrBlank() }
            val lastProvider = providers.firstOrNull { it.id == lastUsed?.providerId && it.enabled }
            if (lastUsed != null && lastProvider != null && lastProvider.models.contains(lastUsed.model)) {
                selectedProviderId = lastProvider.id
                selectedModel = lastUsed.model.orEmpty()
            } else {
                applyDefaultSelection(providers)
            }
        } catch (e: Exception) {
            bannerErrorMessage = ErrorFormatter.format(e)
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
                                try {
                                    val created = client.createConversation()
                                    conversations.add(0, created)
                                    currentConversation = created
                                    messages.clear()
                                } catch (e: Exception) {
                                    bannerErrorMessage = ErrorFormatter.format(e)
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
                        text = "Providers",
                        onClick = {
                            scope.launch { drawerState.close() }
                            onManageProviders()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        variant = LemmaButtonVariant.Secondary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

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

                if (providers.any { it.enabled }) {
                    Box(
                        modifier = Modifier
                            .clip(LemmaTheme.shapes.full)
                            .background(LemmaTheme.colors.fill2)
                            .clickable { showModelPicker = true }
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = selectedModel.ifBlank { "Select model" },
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
                        if (selectedProviderId.isBlank() || selectedModel.isBlank()) {
                            bannerErrorMessage = "Select a model first"
                            return@LemmaInput
                        }
                        inputText = ""

                        scope.launch {
                            var conv = currentConversation
                            if (conv == null) {
                                try {
                                    conv = client.createConversation()
                                    currentConversation = conv
                                    conversations.add(0, conv)
                                } catch (e: Exception) {
                                    bannerErrorMessage = ErrorFormatter.format(e)
                                    return@launch
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
                                client.sendMessage(conv.id, text, selectedProviderId, selectedModel, userMsgId)
                                    .collect { event ->
                                        val lastIdx = messages.indexOfLast { it.id == aiMsgId }
                                        when (event) {
                                            is AgentStreamEvent.Delta -> {
                                                if (lastIdx >= 0) {
                                                    val old = messages[lastIdx]
                                                    messages[lastIdx] = old.copy(text = old.text + event.text)
                                                }
                                            }
                                            is AgentStreamEvent.Done -> {
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
                                            }
                                            is AgentStreamEvent.Error -> {
                                                if (lastIdx >= 0) {
                                                    val old = messages[lastIdx]
                                                    messages[lastIdx] = old.copy(text = old.text + "\n[Error: ${event.message}]")
                                                }
                                            }
                                            else -> {}
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

    if (showModelPicker) {
        Dialog(onDismissRequest = { showModelPicker = false }) {
            Column(
                modifier = Modifier
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
            ) {
                Text(
                    text = "Select Model",
                    style = LemmaTheme.typography.titleMedium,
                    color = LemmaTheme.colors.textPrimary
                )
                Spacer(modifier = Modifier.height(12.dp))
                LazyColumn(
                    modifier = Modifier.weight(1f, fill = false),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    providers.filter { it.enabled }.forEach { provider ->
                        item(key = "header_${provider.id}") {
                            Text(
                                text = provider.name,
                                style = LemmaTheme.typography.labelSmall,
                                color = LemmaTheme.colors.textTertiary,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        items(provider.models, key = { "${provider.id}/$it" }) { model ->
                            val isSelected = provider.id == selectedProviderId && model == selectedModel
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(LemmaTheme.shapes.medium)
                                    .background(
                                        if (isSelected) LemmaTheme.colors.fill2 else LemmaTheme.colors.fill1
                                    )
                                    .clickable {
                                        selectedProviderId = provider.id
                                        selectedModel = model
                                        settingsRepository.setDefaultProviderId(provider.id)
                                        settingsRepository.setDefaultModel(model)
                                        showModelPicker = false
                                    }
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = model,
                                    style = LemmaTheme.typography.bodyMedium,
                                    color = LemmaTheme.colors.textPrimary
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                LemmaButton(
                    text = "Manage Providers",
                    onClick = {
                        showModelPicker = false
                        onManageProviders()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    variant = LemmaButtonVariant.Secondary
                )
            }
        }
    }
}
