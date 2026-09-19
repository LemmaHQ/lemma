package dev.lemmahq.lemma.ui.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaTextField
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun SetupScreen(
    settingsRepository: SettingsRepository,
    onConnected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var urlInput by remember {
        mutableStateOf(settingsRepository.getServerUrl() ?: "http://127.0.0.1:1025")
    }
    var isConnecting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(LemmaTheme.colors.background)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Lemma",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Enter the address of your Lemma server.",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary
            )

            Spacer(modifier = Modifier.height(28.dp))

            LemmaTextField(
                value = urlInput,
                onValueChange = {
                    urlInput = it
                    errorMessage = null
                },
                placeholder = "http://192.168.1.100:1025",
                enabled = !isConnecting
            )

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = errorMessage.orEmpty(),
                    style = LemmaTheme.typography.labelSmall,
                    color = LemmaTheme.colors.danger,
                    modifier = Modifier.align(Alignment.Start)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            if (isConnecting) {
                CircularProgressIndicator(
                    color = LemmaTheme.colors.primary,
                    modifier = Modifier.size(28.dp)
                )
            } else {
                LemmaButton(
                    text = "Connect",
                    onClick = {
                        val cleanedUrl = urlInput.trim().trimEnd('/')
                        if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
                            errorMessage = "Enter a full address starting with http:// or https://"
                            return@LemmaButton
                        }

                        isConnecting = true
                        errorMessage = null

                        scope.launch {
                            val success = withContext(Dispatchers.IO) {
                                try {
                                    val connection = URL("$cleanedUrl/").openConnection() as HttpURLConnection
                                    connection.connectTimeout = 4000
                                    connection.readTimeout = 4000
                                    connection.requestMethod = "GET"
                                    connection.responseCode >= 0
                                } catch (e: Exception) {
                                    false
                                }
                            }

                            isConnecting = false
                            if (success) {
                                settingsRepository.setServerUrl(cleanedUrl)
                                onConnected(cleanedUrl)
                            } else {
                                errorMessage = "Cannot reach $cleanedUrl"
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    variant = LemmaButtonVariant.Primary
                )
            }
        }
    }
}
