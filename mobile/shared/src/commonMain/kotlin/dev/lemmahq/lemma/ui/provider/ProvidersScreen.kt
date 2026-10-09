package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaTextField
import kotlinx.coroutines.launch

private val PROVIDER_KINDS = listOf("openai", "anthropic", "gemini")
private val IDENTIFIER_PATTERN = Regex("^[a-z0-9][a-z0-9-]*$")

/** Provider management screen listing, creating, editing, and deleting provider configurations. */
@Composable
fun ProvidersScreen(
    client: LemmaClient,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
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
        modifier = modifier
            .fillMaxSize()
            .background(LemmaTheme.colors.background)
            .padding(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "‹",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
                modifier = Modifier.clickable(onClick = onBack)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "Providers",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        LemmaButton(
            text = "+ Add Provider",
            onClick = { showAddDialog = true },
            modifier = Modifier.fillMaxWidth(),
            variant = LemmaButtonVariant.Primary
        )

        errorMessage?.let { message ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.danger
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (isLoading) {
            CircularProgressIndicator(
                color = LemmaTheme.colors.primary,
                modifier = Modifier
                    .size(24.dp)
                    .align(Alignment.CenterHorizontally)
            )
        } else if (providers.isEmpty()) {
            Text(
                text = "No providers configured yet",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textTertiary,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(providers, key = { it.id }) { provider ->
                    ProviderRow(
                        provider = provider,
                        onToggleEnabled = { enabled ->
                            scope.launch {
                                try {
                                    client.updateProvider(provider.id, ClientProviderPatch(enabled = enabled))
                                    reload()
                                } catch (e: Exception) {
                                    errorMessage = ErrorFormatter.format(e)
                                }
                            }
                        },
                        onEdit = { editingProvider = provider },
                        onDelete = { deletingProvider = provider }
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
            }
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
            }
        )
    }

    deletingProvider?.let { provider ->
        Dialog(onDismissRequest = { deletingProvider = null }) {
            Column(
                modifier = Modifier
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
            ) {
                Text(
                    text = "Delete ${provider.name}?",
                    style = LemmaTheme.typography.titleMedium,
                    color = LemmaTheme.colors.textPrimary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Conversations keep their history; the provider configuration is removed.",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textSecondary
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LemmaButton(
                        text = "Cancel",
                        onClick = { deletingProvider = null },
                        modifier = Modifier.weight(1f),
                        variant = LemmaButtonVariant.Secondary
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
                        variant = LemmaButtonVariant.Primary
                    )
                }
            }
        }
    }
}

@Composable
private fun ProviderRow(
    provider: ClientProvider,
    onToggleEnabled: (Boolean) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(LemmaTheme.shapes.medium)
            .background(LemmaTheme.colors.fill1)
            .padding(12.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = provider.name,
                    style = LemmaTheme.typography.bodyLarge,
                    color = LemmaTheme.colors.textPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(LemmaTheme.shapes.full)
                        .background(LemmaTheme.colors.fill2)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = provider.kind,
                        style = LemmaTheme.typography.labelSmall,
                        color = LemmaTheme.colors.textSecondary
                    )
                }
            }
            Text(
                text = "${provider.identifier} · ${provider.baseUrl}",
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
                maxLines = 1
            )
            Text(
                text = "${provider.models.size} models",
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    text = "Edit",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.primary,
                    modifier = Modifier.clickable(onClick = onEdit)
                )
                Text(
                    text = "Delete",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.danger,
                    modifier = Modifier.clickable(onClick = onDelete)
                )
            }
        }
        Switch(
            checked = provider.enabled,
            onCheckedChange = onToggleEnabled,
            colors = SwitchDefaults.colors(checkedTrackColor = LemmaTheme.colors.primary)
        )
    }
}

@Composable
private fun ProviderEditorDialog(
    title: String,
    client: LemmaClient,
    existing: ClientProvider?,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var kind by remember { mutableStateOf(existing?.kind ?: PROVIDER_KINDS.first()) }
    var identifier by remember { mutableStateOf(existing?.identifier.orEmpty()) }
    var name by remember { mutableStateOf(existing?.name.orEmpty()) }
    var baseUrl by remember { mutableStateOf(existing?.baseUrl.orEmpty()) }
    var apiKey by remember { mutableStateOf("") }
    var apiPath by remember { mutableStateOf(existing?.apiPath.orEmpty()) }
    var modelsPath by remember { mutableStateOf(existing?.modelsPath.orEmpty()) }
    var modelsText by remember { mutableStateOf(existing?.models?.joinToString("\n").orEmpty()) }
    var isSaving by remember { mutableStateOf(false) }
    var isFetching by remember { mutableStateOf(false) }
    var dialogError by remember { mutableStateOf<String?>(null) }

    val canSave = !isSaving &&
        name.isNotBlank() &&
        baseUrl.isNotBlank() &&
        (existing != null || IDENTIFIER_PATTERN.matches(identifier))

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .clip(LemmaTheme.shapes.medium)
                .background(LemmaTheme.colors.backgroundGroup)
                .verticalScroll(rememberScrollState())
                .padding(20.dp)
        ) {
            Text(
                text = title,
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PROVIDER_KINDS.forEach { option ->
                    val selected = option == kind
                    Box(
                        modifier = Modifier
                            .clip(LemmaTheme.shapes.full)
                            .background(
                                if (selected) LemmaTheme.colors.primary else LemmaTheme.colors.fill2
                            )
                            .clickable(enabled = existing == null) { kind = option }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = option,
                            style = LemmaTheme.typography.labelSmall,
                            color = if (selected) {
                                LemmaTheme.colors.background
                            } else {
                                LemmaTheme.colors.textSecondary
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            LemmaTextField(
                value = identifier,
                onValueChange = { identifier = it },
                placeholder = "Identifier (lowercase, e.g. my-openai)",
                enabled = existing == null
            )
            Spacer(modifier = Modifier.height(8.dp))
            LemmaTextField(
                value = name,
                onValueChange = { name = it },
                placeholder = "Display name"
            )
            Spacer(modifier = Modifier.height(8.dp))
            LemmaTextField(
                value = baseUrl,
                onValueChange = { baseUrl = it },
                placeholder = "https://api.openai.com/v1"
            )
            Spacer(modifier = Modifier.height(8.dp))
            LemmaTextField(
                value = apiKey,
                onValueChange = { apiKey = it },
                placeholder = if (existing?.hasApiKey == true) {
                    "API key (leave blank to keep current)"
                } else {
                    "API key (optional)"
                }
            )
            Spacer(modifier = Modifier.height(8.dp))
            LemmaTextField(
                value = apiPath,
                onValueChange = { apiPath = it },
                placeholder = "Chat endpoint path override (optional)"
            )
            Spacer(modifier = Modifier.height(8.dp))
            LemmaTextField(
                value = modelsPath,
                onValueChange = { modelsPath = it },
                placeholder = "Model-list endpoint path override (optional)"
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Models (one per line)",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textSecondary,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = if (isFetching) "Fetching…" else "Fetch",
                    style = LemmaTheme.typography.bodyMedium,
                    color = if (isFetching) LemmaTheme.colors.textQuaternary else LemmaTheme.colors.primary,
                    modifier = Modifier.clickable(enabled = !isFetching) {
                        scope.launch {
                            isFetching = true
                            try {
                                val fetched = existing
                                    ?.let { client.fetchProviderModels(it.id) }
                                    ?: client.fetchModels(kind, baseUrl, apiKey, modelsPath)
                                modelsText = fetched.joinToString("\n")
                            } catch (e: Exception) {
                                dialogError = ErrorFormatter.format(e)
                            } finally {
                                isFetching = false
                            }
                        }
                    }
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            LemmaTextField(
                value = modelsText,
                onValueChange = { modelsText = it },
                placeholder = "gpt-4o",
                singleLine = false
            )

            dialogError?.let { message ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = message,
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.danger
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LemmaButton(
                    text = "Cancel",
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LemmaButtonVariant.Secondary
                )
                LemmaButton(
                    text = if (isSaving) "Saving…" else "Save",
                    onClick = {
                        val models = modelsText
                            .split(',', '\n')
                            .map { it.trim() }
                            .filter { it.isNotEmpty() }
                            .distinct()
                        scope.launch {
                            isSaving = true
                            try {
                                if (existing == null) {
                                    client.createProvider(
                                        ClientProviderInput(
                                            kind = kind,
                                            identifier = identifier.trim(),
                                            name = name.trim(),
                                            baseUrl = baseUrl.trim(),
                                            apiKey = apiKey.trim(),
                                            apiPath = apiPath.trim(),
                                            modelsPath = modelsPath.trim(),
                                            models = models
                                        )
                                    )
                                } else {
                                    client.updateProvider(
                                        existing.id,
                                        ClientProviderPatch(
                                            name = name.trim(),
                                            baseUrl = baseUrl.trim(),
                                            apiKey = apiKey.trim().ifBlank { null },
                                            apiPath = apiPath.trim(),
                                            modelsPath = modelsPath.trim(),
                                            models = models
                                        )
                                    )
                                }
                                onSaved()
                            } catch (e: Exception) {
                                dialogError = ErrorFormatter.format(e)
                            } finally {
                                isSaving = false
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    variant = LemmaButtonVariant.Primary,
                    enabled = canSave
                )
            }
        }
    }
}
