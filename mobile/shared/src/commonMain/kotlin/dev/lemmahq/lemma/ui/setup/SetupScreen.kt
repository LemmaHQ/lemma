package dev.lemmahq.lemma.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.AppViewModel
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaFormSubmit
import dev.lemmahq.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_app_name
import lemma.mobile.shared.generated.resources.setup_connect
import lemma.mobile.shared.generated.resources.setup_description
import lemma.mobile.shared.generated.resources.setup_url_placeholder
import lemma.mobile.shared.generated.resources.setup_use_local
import org.jetbrains.compose.resources.stringResource

private const val DEFAULT_SERVER_URL = "http://127.0.0.1:1025"

@Composable
internal fun SetupScreen(viewModel: AppViewModel, modifier: Modifier = Modifier) {
    var url by rememberSaveable { mutableStateOf(DEFAULT_SERVER_URL) }

    Box(
        modifier = modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = stringResource(Res.string.common_app_name),
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(Res.string.setup_description),
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
            )
            Spacer(modifier = Modifier.height(28.dp))
            LemmaTextField(
                value = url,
                onValueChange = { url = it },
                placeholder = stringResource(Res.string.setup_url_placeholder),
                enabled = !viewModel.connecting,
            )
            LemmaFormSubmit(
                error = viewModel.setupError?.text(),
                busy = viewModel.connecting,
                text = stringResource(Res.string.setup_connect),
                onSubmit = { viewModel.connectRemote(url) },
            )
            if (viewModel.localAvailable) {
                Spacer(modifier = Modifier.height(16.dp))
                LemmaButton(
                    text = stringResource(Res.string.setup_use_local),
                    onClick = viewModel::useLocal,
                    modifier = Modifier.fillMaxWidth(),
                    variant = LemmaButtonVariant.Secondary,
                    enabled = !viewModel.connecting,
                )
            }
        }
    }
}
