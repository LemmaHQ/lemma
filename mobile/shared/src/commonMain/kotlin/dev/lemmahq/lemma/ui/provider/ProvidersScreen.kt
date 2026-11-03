package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import kotlinx.coroutines.launch

/** Provider management screen listing, creating, editing, and deleting provider configurations. */
@Composable
fun ProvidersScreen(
    client: LemmaClient,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    var providers by remember { mutableStateOf<List<ClientProvider>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingProvider by remember { mutableStateOf<ClientProvider?>(null) }
    var deletingProvider by remember { mutableStateOf<ClientProvider?>(null) }

    fun reload() {
        scope.launch {
            isLoading = true
            try {
                providers = client.listProviders()
            } catch (e: Exception) {
                errorMessage = ErrorFormatter.format(e)
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    Column(
        modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background).padding(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "‹",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
                modifier = Modifier.clickable(onClick = onBack),
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "Providers",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        LemmaButton(
            text = "+ Add Provider",
            onClick = { showAddDialog = true },
            modifier = Modifier.fillMaxWidth(),
            variant = LemmaButtonVariant.Primary,
        )

        errorMessage?.let { message ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.danger,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (isLoading) {
            CircularProgressIndicator(
                color = LemmaTheme.colors.primary,
                modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally),
            )
        } else if (providers.isEmpty()) {
            Text(
                text = "No providers configured yet",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textTertiary,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(providers, key = { it.id }) { provider ->
                    ProviderRow(
                        provider = provider,
                        onToggleEnabled = { enabled ->
                            scope.launch {
                                try {
                                    client.updateProvider(
                                        provider.id,
                                        ClientProviderPatch(enabled = enabled),
                                    )
                                    reload()
                                } catch (e: Exception) {
                                    errorMessage = ErrorFormatter.format(e)
                                }
                            }
                        },
                        onEdit = { editingProvider = provider },
                        onDelete = { deletingProvider = provider },
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        ProviderEditorDialog(
            title = "Add Provider",
            client = client,
            existing = null,
            onDismiss = { showAddDialog = false },
            onSaved = {
                showAddDialog = false
                reload()
            },
        )
    }

    editingProvider?.let { provider ->
        ProviderEditorDialog(
            title = "Edit Provider",
            client = client,
            existing = provider,
            onDismiss = { editingProvider = null },
            onSaved = {
                editingProvider = null
                reload()
            },
        )
    }

    deletingProvider?.let { provider ->
        Dialog(onDismissRequest = { deletingProvider = null }) {
            Column(
                modifier =
                    Modifier.clip(LemmaTheme.shapes.medium)
                        .background(LemmaTheme.colors.backgroundGroup)
                        .padding(20.dp)
            ) {
                Text(
                    text = "Delete ${provider.name}?",
                    style = LemmaTheme.typography.titleMedium,
                    color = LemmaTheme.colors.textPrimary,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Sessions keep their history; the provider configuration is removed.",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textSecondary,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LemmaButton(
                        text = "Cancel",
                        onClick = { deletingProvider = null },
                        modifier = Modifier.weight(1f),
                        variant = LemmaButtonVariant.Secondary,
                    )
                    LemmaButton(
                        text = "Delete",
                        onClick = {
                            scope.launch {
                                try {
                                    client.deleteProvider(provider.id)
                                    deletingProvider = null
                                    reload()
                                } catch (e: Exception) {
                                    errorMessage = ErrorFormatter.format(e)
                                    deletingProvider = null
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        variant = LemmaButtonVariant.Primary,
                    )
                }
            }
        }
    }
}
