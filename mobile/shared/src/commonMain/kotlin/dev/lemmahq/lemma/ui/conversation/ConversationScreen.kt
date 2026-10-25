package dev.lemmahq.lemma.ui.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaBubbleRole
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_aborted_notice
import lemma.mobile.shared.generated.resources.agent_stop
import org.jetbrains.compose.resources.stringResource

@Composable
fun ConversationScreen(
    client: LemmaClient,
    settingsRepository: SettingsRepository,
    onLogout: () -> Unit,
    onManageProviders: () -> Unit,
    localMessageRepository: LocalMessageRepository,
    modifier: Modifier = Modifier,
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val state = rememberConversationState()

    val stopDescription = stringResource(Res.string.agent_stop)
    val abortedNotice = stringResource(Res.string.agent_aborted_notice)

    fun applyDefaultSelection(available: List<ClientProvider>) {
        val defaultProviderId = settingsRepository.getDefaultProviderId()
        val defaultModel = settingsRepository.getDefaultModel()
        val fromSettings =
            available
                .firstOrNull { it.id == defaultProviderId && it.enabled }
                ?.takeIf { defaultModel != null && it.models.contains(defaultModel) }
        if (fromSettings != null) {
            state.selectedProviderId = fromSettings.id
            state.selectedModel = defaultModel.orEmpty()
        } else {
            val first = available.firstOrNull { it.enabled }
            state.selectedProviderId = first?.id.orEmpty()
            state.selectedModel = first?.models?.firstOrNull().orEmpty()
        }
    }

    LaunchedEffect(Unit) {
        state.isLoadingConversations = true
        try {
            val loaded = client.listProviders()
            state.providers = loaded
            applyDefaultSelection(loaded)
        } catch (e: Exception) {
            state.bannerErrorMessage = ErrorFormatter.format(e)
        } finally {
            state.isLoadingConversations = false
            state.providersLoaded = true
        }
    }

    LaunchedEffect(state.currentConversation?.id, state.providersLoaded) {
        if (!state.providersLoaded) return@LaunchedEffect
        val convId = state.currentConversation?.id
        if (convId == null) {
            state.messages.clear()
            return@LaunchedEffect
        }
        val cachedMsgs = localMessageRepository.getMessages(convId)
        if (cachedMsgs.isNotEmpty()) {
            state.messages.clear()
            state.messages.addAll(
                cachedMsgs.map { m ->
                    UiMessage(
                        id = m.id,
                        role =
                            if (m.role == 1L) LemmaBubbleRole.User else LemmaBubbleRole.Assistant,
                        text = m.content,
                    )
                }
            )
        } else {
            state.messages.clear()
        }

        try {
            val serverMsgs = client.listMessages(convId)
            val list =
                serverMsgs.asReversed().map {
                    UiMessage(
                        id = it.id,
                        role =
                            if (it.role == "user") LemmaBubbleRole.User
                            else LemmaBubbleRole.Assistant,
                        text = it.content,
                    )
                }
            state.messages.clear()
            state.messages.addAll(list)
            for (m in serverMsgs) {
                localMessageRepository.saveMessage(
                    id = m.id,
                    conversationId = convId,
                    role = if (m.role == "user") 1L else 2L,
                    content = m.content,
                    status = 2L,
                    createdAt = m.createdAtSeconds,
                    updatedAt = m.updatedAtSeconds,
                )
            }
            val lastUsed = serverMsgs.firstOrNull {
                it.role == "assistant" && !it.model.isNullOrBlank()
            }
            val lastProvider =
                state.providers.firstOrNull { it.id == lastUsed?.providerId && it.enabled }
            if (
                lastUsed != null &&
                    lastProvider != null &&
                    lastProvider.models.contains(lastUsed.model)
            ) {
                state.selectedProviderId = lastProvider.id
                state.selectedModel = lastUsed.model.orEmpty()
            } else {
                applyDefaultSelection(state.providers)
            }
        } catch (e: Exception) {
            state.bannerErrorMessage = ErrorFormatter.format(e)
        }
    }

    LaunchedEffect(state.messages.size, state.messages.lastOrNull()?.text) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.size - 1)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ConversationDrawer(
                conversations = state.conversations,
                currentConversationId = state.currentConversation?.id,
                isLoading = state.isLoadingConversations,
                onNewConversation = {
                    scope.launch {
                        drawerState.close()
                        try {
                            val created = client.createConversation()
                            state.conversations.add(0, created)
                            state.currentConversation = created
                            state.messages.clear()
                        } catch (e: Exception) {
                            state.bannerErrorMessage = ErrorFormatter.format(e)
                        }
                    }
                },
                onSelectConversation = { conversation ->
                    state.currentConversation = conversation
                    scope.launch { drawerState.close() }
                },
                onManageProviders = {
                    scope.launch { drawerState.close() }
                    onManageProviders()
                },
                onLogout = onLogout,
            )
        },
    ) {
        Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
            ConversationTopBar(
                title = state.currentConversation?.title?.ifBlank { "Lemma" } ?: "Lemma",
                modelLabel =
                    if (state.providers.any { it.enabled }) {
                        state.selectedModel.ifBlank { "Select model" }
                    } else {
                        null
                    },
                onOpenDrawer = { scope.launch { drawerState.open() } },
                onOpenModelPicker = { state.showModelPicker = true },
            )

            Box(
                modifier =
                    Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.separator)
            )

            MessageList(
                messages = state.messages,
                listState = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
            )

            state.bannerErrorMessage?.let { message ->
                ErrorBanner(
                    message = message,
                    showRetry = state.lastFailedText != null && !state.isStreaming,
                    onRetry = {
                        state.inputText = state.lastFailedText.orEmpty()
                        state.bannerErrorMessage = null
                        state.lastFailedText = null
                    },
                    onDismiss = { state.bannerErrorMessage = null },
                )
            }

            MessageComposer(
                value = state.inputText,
                onValueChange = { state.inputText = it },
                isStreaming = state.isStreaming && state.streamingMessageId != null,
                stopDescription = stopDescription,
                onStop = {
                    val messageId = state.streamingMessageId ?: return@MessageComposer
                    scope.launch {
                        try {
                            client.abortMessage(messageId)
                        } catch (e: Exception) {
                            state.bannerErrorMessage = ErrorFormatter.format(e)
                        }
                    }
                },
                onSend = {
                    val text = state.inputText.trim()
                    if (text.isBlank() || state.isStreaming) return@MessageComposer
                    if (state.selectedProviderId.isBlank() || state.selectedModel.isBlank()) {
                        state.bannerErrorMessage = "Select a model first"
                        return@MessageComposer
                    }
                    state.inputText = ""
                    scope.launch {
                        sendTurn(state, client, localMessageRepository, text, abortedNotice)
                    }
                },
            )
        }
    }

    if (state.showModelPicker) {
        ModelPickerDialog(
            providers = state.providers,
            selectedProviderId = state.selectedProviderId,
            selectedModel = state.selectedModel,
            onSelect = { providerId, model ->
                state.selectedProviderId = providerId
                state.selectedModel = model
                settingsRepository.setDefaultProviderId(providerId)
                settingsRepository.setDefaultModel(model)
                state.showModelPicker = false
            },
            onManageProviders = {
                state.showModelPicker = false
                onManageProviders()
            },
            onDismiss = { state.showModelPicker = false },
        )
    }
}
