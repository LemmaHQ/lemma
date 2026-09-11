package com.lemmaos.lemma.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.lemmaos.lemma.data.ServerConfigStore
import com.lemmaos.lemma.data.normalizeServerUrl

@Composable
fun ServerUrlScreen(store: ServerConfigStore, onContinue: () -> Unit) {
    var input by remember { mutableStateOf(store.serverUrl ?: "") }
    var error by remember { mutableStateOf(false) }

    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("Connect to a server", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = input,
                onValueChange = {
                    input = it
                    error = false
                },
                label = { Text("Server URL") },
                placeholder = { Text("http://127.0.0.1:1025") },
                isError = error,
                supportingText = if (error) ({ Text("Enter a valid http(s) URL") }) else null,
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Done,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    val normalized = normalizeServerUrl(input)
                    if (normalized == null) {
                        error = true
                    } else {
                        store.save(normalized)
                        onContinue()
                    }
                },
                enabled = input.isNotBlank(),
            ) {
                Text("Continue")
            }
        }
    }
}
