package com.lemmaos.lemma.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.lemmaos.lemma.data.StoragePatch
import com.lemmaos.lemma.i18n.I18n
import com.lemmaos.lemma.ui.storage.StorageViewModel

@Composable
fun StorageScreen(
    viewModel: StorageViewModel,
    onBack: () -> Unit,
) {
    val config by viewModel.config.collectAsState()
    val progress by viewModel.migrationProgress.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    // Secret fields always start empty: the backend only exposes masked
    // values, and an empty field means "keep the current key".
    var endpoint by remember { mutableStateOf("") }
    var region by remember { mutableStateOf("") }
    var bucket by remember { mutableStateOf("") }
    var accessKey by remember { mutableStateOf("") }
    var secretKey by remember { mutableStateOf("") }
    var deleteConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(config) {
        config?.let {
            endpoint = it.endpoint
            region = it.region
            bucket = it.bucket
        }
    }
    LaunchedEffect(Unit) { viewModel.refresh() }

    val patch = StoragePatch(
        endpoint = endpoint.trim(),
        region = region.trim(),
        bucket = bucket.trim(),
        accessKey = accessKey,
        secretKey = secretKey,
    )
    val canSave = endpoint.isNotBlank() && bucket.isNotBlank()

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                }
                Text(I18n.t("storage.title"), style = MaterialTheme.typography.titleMedium)
            }

            uiState.error?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }
            uiState.testMessage?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }

            if (config == null) {
                Text(
                    I18n.t("storage.notConfigured"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            }

            OutlinedTextField(
                value = endpoint,
                onValueChange = { endpoint = it },
                label = { Text(I18n.t("storage.endpoint")) },
                placeholder = { Text("http://127.0.0.1:9000") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = region,
                onValueChange = { region = it },
                label = { Text(I18n.t("storage.region")) },
                placeholder = { Text("us-east-1") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = bucket,
                onValueChange = { bucket = it },
                label = { Text(I18n.t("storage.bucket")) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = accessKey,
                onValueChange = { accessKey = it },
                label = {
                    Text(if (config != null) I18n.t("storage.accessKeyKeep") else I18n.t("storage.accessKey"))
                },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = secretKey,
                onValueChange = { secretKey = it },
                label = {
                    Text(if (config != null) I18n.t("storage.secretKeyKeep") else I18n.t("storage.secretKey"))
                },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { viewModel.save(patch) },
                    enabled = !uiState.busy && canSave,
                ) {
                    if (uiState.busy) {
                        CircularProgressIndicator(
                            modifier = Modifier.height(18.dp).padding(end = 8.dp),
                            strokeWidth = 2.dp,
                        )
                    }
                    Text(I18n.t("storage.save"))
                }
                OutlinedButton(
                    onClick = { viewModel.test(patch) },
                    enabled = !uiState.busy && canSave,
                ) {
                    Text(I18n.t("storage.test"))
                }
                if (config != null) {
                    TextButton(
                        onClick = { deleteConfirm = true },
                        enabled = !uiState.busy,
                    ) {
                        Text(I18n.t("storage.delete"))
                    }
                }
            }

            config?.let { cfg ->
                if (cfg.pendingMigration) {
                    Spacer(Modifier.height(24.dp))
                    Text(I18n.t("storage.pending"), style = MaterialTheme.typography.titleSmall)
                    progress?.let { p ->
                        LinearProgressIndicator(
                            progress = { if (p.total > 0) p.done.toFloat() / p.total else 0f },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        )
                        Text(
                            "${p.done}/${p.total} done, ${p.skipped} skipped",
                            style = MaterialTheme.typography.bodySmall,
                        )
                        p.error?.let { err ->
                            Text(
                                err,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                    if (!uiState.migrating) {
                        TextButton(onClick = viewModel::migrate) {
                            Text(I18n.t("storage.migrate"))
                        }
                    }
                }
            }
        }
    }

    if (deleteConfirm) {
        AlertDialog(
            onDismissRequest = { deleteConfirm = false },
            title = { Text(I18n.t("storage.deleteTitle")) },
            text = {
                Text(I18n.t("storage.deleteBody"))
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.delete()
                    deleteConfirm = false
                }) { Text(I18n.t("storage.delete")) }
            },
            dismissButton = {
                TextButton(onClick = { deleteConfirm = false }) { Text(I18n.t("providers.cancel")) }
            },
        )
    }
}
