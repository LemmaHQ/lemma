package com.lemmaos.lemma.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material3.AlertDialog
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.lemmaos.lemma.domain.Conversation
import com.lemmaos.lemma.ui.chat.ChatPane
import com.lemmaos.lemma.ui.chat.ChatViewModel
import com.lemmaos.lemma.ui.chat.toUiState
import com.lemmaos.lemma.ui.conversations.ConversationsViewModel
import com.lemmaos.lemma.domain.Provider
import com.lemmaos.lemma.ui.chat.ModelChoice
import com.lemmaos.lemma.ui.conversations.groupKeyLabel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.lemmaos.lemma.ui.LocalLemmaColors
import com.lemmaos.lemma.i18n.I18n
import com.lemmaos.lemma.i18n.Language
import androidx.compose.ui.unit.dp

@Composable
fun ConversationsScreen(
    conversationsViewModel: ConversationsViewModel,
    chatViewModel: ChatViewModel?,
    providers: List<Provider>,
    modelChoice: ModelChoice?,
    onSelectModel: (ModelChoice) -> Unit,
    onLogout: () -> Unit,
    onToggleLanguage: () -> Unit = {},
    onOpenProviders: () -> Unit = {},
    onOpenStorage: () -> Unit = {},
) {
    val list by conversationsViewModel.list.collectAsState()
    val archived by conversationsViewModel.archived.collectAsState()
    val groups by conversationsViewModel.groups.collectAsState()
    val uiState by conversationsViewModel.uiState.collectAsState()
    var showArchived by remember { mutableStateOf(false) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var renameTarget by remember { mutableStateOf<Conversation?>(null) }

    Scaffold { padding ->
        Row(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier.width(280.dp).fillMaxHeight()
                    .background(LocalLemmaColors.current.sidebar),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (showArchived) I18n.t("conversations.archivedTitle") else I18n.t("conversations.title"),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                    if (!showArchived) {
                        IconButton(onClick = { conversationsViewModel.create {} }) {
                            Icon(Icons.Filled.Add, contentDescription = I18n.t("conversations.new"))
                        }
                        var settingsOpen by remember { mutableStateOf(false) }
                        Box {
                            IconButton(onClick = { settingsOpen = true }) {
                                Icon(Icons.Filled.Settings, contentDescription = I18n.t("conversations.settings"))
                            }
                            DropdownMenu(expanded = settingsOpen, onDismissRequest = { settingsOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text(I18n.t("providers.title")) },
                                    onClick = {
                                        settingsOpen = false
                                        onOpenProviders()
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text(I18n.t("storage.title")) },
                                    onClick = {
                                        settingsOpen = false
                                        onOpenStorage()
                                    },
                                )
                                DropdownMenuItem(
                                    text = {
                                        Text(if (I18n.current == Language.EN) "中文" else "English")
                                    },
                                    leadingIcon = { Icon(Icons.Filled.Language, null) },
                                    onClick = {
                                        settingsOpen = false
                                        onToggleLanguage()
                                    },
                                )
                            }
                        }
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = I18n.t("conversations.signOut"))
                    }
                }

                Row(modifier = Modifier.padding(horizontal = 12.dp)) {
                    FilterTab(I18n.t("conversations.active"), !showArchived) { showArchived = false }
                    Spacer(Modifier.width(8.dp))
                    FilterTab(I18n.t("conversations.archived"), showArchived) { showArchived = true }
                }

                uiState.error?.let {
                    Text(
                        it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }

                if (showArchived) {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(archived, key = { it.id }) { conversation ->
                            ConversationRow(
                                conversation = conversation,
                                selected = false,
                                onClick = {},
                                actions = {
                                    DropdownMenuItem(
                                        text = { Text(I18n.t("conversations.restore")) },
                                        leadingIcon = { Icon(Icons.Filled.RestoreFromTrash, null) },
                                        onClick = {
                                            conversationsViewModel.restore(conversation.id)
                                            close()
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text(I18n.t("conversations.delete")) },
                                        leadingIcon = { Icon(Icons.Filled.Delete, null) },
                                        onClick = {
                                            conversationsViewModel.deleteArchived(conversation.id)
                                            close()
                                        },
                                    )
                                },
                            )
                        }
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        groups.forEach { group ->
                            item(key = "header-${group.key}") {
                                Text(
                                    groupKeyLabel(group.key),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(
                                        start = 16.dp, end = 16.dp, top = 12.dp, bottom = 4.dp,
                                    ),
                                )
                            }
                            items(group.items, key = { it.id }) { conversation ->
                                ConversationRow(
                                    conversation = conversation,
                                    selected = conversation.id == selectedId,
                                    onClick = { selectedId = conversation.id },
                                    actions = {
                                        DropdownMenuItem(
                                            text = { Text(I18n.t("conversations.rename")) },
                                            leadingIcon = { Icon(Icons.Filled.Edit, null) },
                                            onClick = {
                                                renameTarget = conversation
                                                close()
                                            },
                                        )
                                        DropdownMenuItem(
                                            text = { Text(I18n.t("conversations.archive")) },
                                            leadingIcon = { Icon(Icons.Filled.Archive, null) },
                                            onClick = {
                                                conversationsViewModel.archive(conversation.id)
                                                close()
                                            },
                                        )
                                    },
                                )
                            }
                        }
                    }
                }
            }
            Box(
                modifier = Modifier.weight(1f).fillMaxHeight(),
            ) {
                val vm = chatViewModel
                if (vm == null || selectedId == null) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            if (list.isEmpty()) I18n.t("conversations.empty") else I18n.t("conversations.select"),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    val chatState by vm.state.collectAsState()
                    LaunchedEffect(selectedId) { vm.open(selectedId!!) }
                    ChatPane(
                        state = chatState.toUiState(),
                        modelChoice = modelChoice,
                        providers = providers,
                        onSelectModel = onSelectModel,
                        onSend = { content ->
                            vm.send(
                                providerId = modelChoice?.providerId.orEmpty(),
                                model = modelChoice?.model.orEmpty(),
                                content = content,
                            )
                        },
                        onAbort = vm::abort,
                        onLoadMore = vm::loadMore,
                    )
                }
            }
        }
    }

    renameTarget?.let { target ->
        RenameDialog(
            initial = target.title,
            onDismiss = { renameTarget = null },
            onConfirm = { title ->
                conversationsViewModel.rename(target.id, title)
                renameTarget = null
            },
        )
    }
}

@Composable
private fun FilterTab(label: String, active: Boolean, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (active) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
        )
    }
}

@Composable
private fun ConversationRow(
    conversation: Conversation,
    selected: Boolean,
    onClick: () -> Unit,
    actions: @Composable DropdownMenuScope.() -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            conversation.title.ifBlank { I18n.t("conversations.untitled") },
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 1,
            color = if (selected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            modifier = Modifier.weight(1f).padding(start = 8.dp),
        )
        Box {
            IconButton(onClick = { menuOpen = true }, modifier = Modifier.height(32.dp)) {
                Icon(Icons.Filled.MoreVert, contentDescription = "Conversation actions")
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                actions(DropdownMenuScope(menuOpen, { menuOpen = false }))
            }
        }
    }
}

class DropdownMenuScope(val open: Boolean, val close: () -> Unit)

@Composable
private fun RenameDialog(
    initial: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var title by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(I18n.t("conversations.renameTitle")) },
        text = {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                singleLine = true,
            )
        },
        confirmButton = {
            Button(onClick = { onConfirm(title.trim()) }, enabled = title.isNotBlank()) {
                Text(I18n.t("conversations.rename"))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(I18n.t("providers.cancel")) }
        },
    )
}
