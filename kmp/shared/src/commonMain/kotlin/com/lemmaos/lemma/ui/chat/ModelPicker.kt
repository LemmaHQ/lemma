package com.lemmaos.lemma.ui.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.ui.Modifier
import com.lemmaos.lemma.i18n.I18n
import com.lemmaos.lemma.domain.Provider

// A model choice = one enabled provider + one of its models.
data class ModelChoice(val providerId: String, val providerName: String, val model: String)

@Composable
fun ModelPicker(
    providers: List<Provider>,
    selection: ModelChoice?,
    onSelect: (ModelChoice) -> Unit,
) {
    var open by remember { mutableStateOf(false) }

    Box {
        Row {
            Text(selection?.model ?: I18n.t("chat.selectModel"))
            IconButton(onClick = { open = true }) {
                Icon(Icons.Filled.ExpandMore, contentDescription = "Choose model")
            }
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            for (provider in providers.filter { it.enabled && it.models.isNotEmpty() }) {
                for (model in provider.models) {
                    DropdownMenuItem(
                        text = { Text("${provider.name} / $model") },
                        onClick = {
                            open = false
                            onSelect(ModelChoice(provider.id, provider.name, model))
                        },
                    )
                }
            }
        }
    }
}
