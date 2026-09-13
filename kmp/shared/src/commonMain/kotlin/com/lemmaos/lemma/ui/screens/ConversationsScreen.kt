package com.lemmaos.lemma.ui.screens

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
import androidx.compose.material.icons.filled.Logout
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
import com.lemmaos.lemma.ui.conversations.groupKeyLabel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ConversationsScreen(
    conversationsViewModel: ConversationsViewModel,
    chatViewModel: ChatViewModel?,
    onLogout: () -> Unit,
    onOpenProviders: () -> Unit = {},
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
                modifier = Modifier.width(280.dp).fillMaxHeight(),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        if (showArchived) "Archived" else "Conversations",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                    if (!showArchived) {
                        IconButton(onClick = { conversationsViewModel.create {} }) {
                            Icon(Icons.Filled.Add, contentDescription = "New conversation")
                        }
                        IconButton(onClick = onOpenProviders) {
                            Icon(Icons.Filled.Settings, contentDescription = "Providers")
                        }
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Filled.Logout, contentDescription = "Sign out")
                    }
                }

                Row(modifier = Modifier.padding(horizontal = 12.dp)) {
                    FilterTab("Active", !showArchived) { showArchived = false }
                    Spacer(Modifier.width(8.dp))
                    FilterTab("Archived", showArchived) { showArchived = true }
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
                                        text = { Text("Restore") },
                                        leadingIcon = { Icon(Icons.Filled.RestoreFromTrash, null) },
                                        onClick = {
                                            conversationsViewModel.restore(conversation.id)
                                            close()
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Delete permanently") },
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
                                            text = { Text("Rename") },
                                            leadingIcon = { Icon(Icons.Filled.Edit, null) },
                                            onClick = {
                                                renameTarget = conversation
                                                close()
                                            },
                                        )
                                        DropdownMenuItem(
                                            text = { Text("Archive") },
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
                            if (list.isEmpty()) "No conversations yet" else "Select a conversation",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    val chatState by vm.state.collectAsState()
                    LaunchedEffect(selectedId) { vm.open(selectedId!!) }
                    ChatPane(
                        state = chatState.toUiState(),
                        onSend = { content -> vm.send(providerId = "", model = "", content = content) },
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
            conversation.title.ifBlank { "Untitled" },
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
        title = { Text("Rename conversation") },
        text = {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                singleLine = true,
            )
        },
        confirmButton = {
            Button(onClick = { onConfirm(title.trim()) }, enabled = title.isNotBlank()) {
                Text("Rename")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
