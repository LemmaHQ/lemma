package com.lemmaos.lemma.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.lemmaos.lemma.data.NewProvider
import com.lemmaos.lemma.data.ProviderPatch
import com.lemmaos.lemma.domain.Provider
import com.lemmaos.lemma.ui.providers.ProvidersViewModel

private val KINDS = listOf("openai" to 1, "anthropic" to 2, "gemini" to 3)

@Composable
fun ProvidersScreen(
    viewModel: ProvidersViewModel,
    onBack: () -> Unit,
) {
    val list by viewModel.list.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var editorTarget by remember { mutableStateOf<Provider?>(null) }
    var createOpen by remember { mutableStateOf(false) }

    Scaffold { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                }
                Text("Providers", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                IconButton(onClick = { createOpen = true }) {
                    Icon(Icons.Filled.Add, contentDescription = "Add provider")
                }
            }

            uiState.error?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }

            if (list.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        "No providers configured",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyColumn {
                    items(list, key = { it.id }) { provider ->
                        ProviderRow(
                            provider = provider,
                            onEdit = { editorTarget = provider },
                            onDelete = { viewModel.remove(provider.id) },
                        )
                    }
                }
            }
        }
    }

    if (createOpen) {
        ProviderEditorDialog(
            initial = null,
            busy = uiState.busy,
            onDismiss = { createOpen = false },
            onSave = { input, models ->
                viewModel.create(input.copy(models = models)) { createOpen = false }
            },
            onFetchModels = { kind, baseUrl, apiKey, modelsPath, onResult ->
                viewModel.fetchModels(null, kind, baseUrl, apiKey, modelsPath, onResult)
            },
        )
    }

    editorTarget?.let { target ->
        ProviderEditorDialog(
            initial = target,
            busy = uiState.busy,
            onDismiss = { editorTarget = null },
            onSave = { input, models ->
                viewModel.update(
                    target.id,
                    ProviderPatch(
                        name = input.name,
                        baseUrl = input.baseUrl,
                        apiKey = input.apiKey.takeIf { it.isNotEmpty() },
                        apiPath = input.apiPath,
                        modelsPath = input.modelsPath,
                        models = models,
                    ),
                )
                editorTarget = null
            },
            onFetchModels = { _, _, _, _, onResult ->
                viewModel.fetchModels(target.id, null, null, null, null, onResult)
            },
        )
    }
}

@Composable
private fun ProviderRow(
    provider: Provider,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${provider.name} (${provider.kind})",
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                provider.baseUrl,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (provider.models.isNotEmpty()) {
                Text(
                    "${provider.models.size} models",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Checkbox(checked = provider.enabled, onCheckedChange = null)
        IconButton(onClick = onEdit) {
            Icon(Icons.Filled.Edit, contentDescription = "Edit provider")
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Filled.Delete, contentDescription = "Delete provider")
        }
    }
}

@Composable
private fun ProviderEditorDialog(
    initial: Provider?,
    busy: Boolean,
    onDismiss: () -> Unit,
    onSave: (NewProvider, List<String>) -> Unit,
    onFetchModels: (
        kind: Int,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
        onResult: (List<String>) -> Unit,
    ) -> Unit,
) {
    var kind by remember {
        mutableStateOf(initial?.let { p -> KINDS.firstOrNull { it.first == p.kind }?.second } ?: 1)
    }
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var baseUrl by remember { mutableStateOf(initial?.baseUrl ?: "") }
    // Never prefill the masked display value; the server would seal it as if
    // it were the real key.
    var apiKey by remember { mutableStateOf("") }
    var apiPath by remember { mutableStateOf(initial?.apiPath ?: "") }
    var modelsPath by remember { mutableStateOf(initial?.modelsPath ?: "") }
    var models by remember { mutableStateOf(initial?.models ?: emptyList()) }
    var modelsText by remember { mutableStateOf((initial?.models ?: emptyList()).joinToString("\n")) }
    var fetching by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial == null) "Add provider" else "Edit provider") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KINDS.forEach { (label, value) ->
                        FilterChip(
                            selected = kind == value,
                            onClick = { kind = value },
                            label = { Text(label) },
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { baseUrl = it },
                    label = { Text("Base URL") },
                    placeholder = { Text("https://api.openai.com/v1") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = apiKey,
                    onValueChange = { apiKey = it },
                    label = { Text(if (initial == null) "API key" else "API key (leave blank to keep)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = apiPath,
                    onValueChange = { apiPath = it },
                    label = { Text("API path (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = modelsPath,
                    onValueChange = { modelsPath = it },
                    label = { Text("Models path (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = {
                            fetching = true
                            onFetchModels(kind, baseUrl, apiKey, modelsPath) { result ->
                                models = result
                                modelsText = result.joinToString("\n")
                                fetching = false
                            }
                        },
                        enabled = !fetching && baseUrl.isNotBlank(),
                    ) {
                        if (fetching) {
                            CircularProgressIndicator(
                                modifier = Modifier.height(16.dp).width(16.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Fetch models")
                    }
                }
                OutlinedTextField(
                    value = modelsText,
                    onValueChange = {
                        modelsText = it
                        models = it.lines().map { line -> line.trim() }.filter { it.isNotEmpty() }
                    },
                    label = { Text("Models (one per line)") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        NewProvider(
                            kind = kind,
                            name = name.trim(),
                            baseUrl = baseUrl.trim(),
                            apiKey = apiKey.trim(),
                            models = models,
                            apiPath = apiPath.trim(),
                            modelsPath = modelsPath.trim(),
                        ),
                        models,
                    )
                },
                enabled = !busy && name.isNotBlank() && baseUrl.isNotBlank() &&
                    (initial != null || apiKey.isNotBlank()),
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
