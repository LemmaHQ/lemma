package io.github.mistvesper.lemma.ui.webprovider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ClientWebFunction
import io.github.mistvesper.lemma.client.ClientWebProvider
import io.github.mistvesper.lemma.client.ClientWebProviderKind
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaField
import io.github.mistvesper.lemma.ui.components.LemmaPasswordField
import io.github.mistvesper.lemma.ui.components.LemmaSettingsGroup
import io.github.mistvesper.lemma.ui.components.LemmaTopBar
import io.github.mistvesper.lemma.ui.components.ProviderEnabledRow
import io.github.mistvesper.lemma.ui.components.ProviderErrorText
import io.github.mistvesper.lemma.ui.components.SaveBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_api_key
import lemma.mobile.shared.generated.resources.provider_api_key_desc
import lemma.mobile.shared.generated.resources.provider_api_key_placeholder
import lemma.mobile.shared.generated.resources.provider_enable_needs_key
import lemma.mobile.shared.generated.resources.provider_enable_web_provider
import lemma.mobile.shared.generated.resources.provider_unsaved_changes
import lemma.mobile.shared.generated.resources.provider_web_backends
import lemma.mobile.shared.generated.resources.provider_web_backends_desc
import lemma.mobile.shared.generated.resources.provider_web_fetch_order
import lemma.mobile.shared.generated.resources.provider_web_fetch_order_desc
import lemma.mobile.shared.generated.resources.provider_web_native_desc
import lemma.mobile.shared.generated.resources.provider_web_search_order
import lemma.mobile.shared.generated.resources.provider_web_search_order_desc
import lemma.mobile.shared.generated.resources.settings_web
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun WebProviderScreen(
    viewModel: WebProviderViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(title = stringResource(Res.string.settings_web), onBack = onBack)
        ProviderErrorText(viewModel.error)
        if (viewModel.loading) {
            Box(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = LemmaTheme.colors.brand)
            }
        } else {
            Column(
                modifier =
                    Modifier.weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                LemmaSettingsGroup(
                    label = stringResource(Res.string.provider_web_backends),
                    description = stringResource(Res.string.provider_web_backends_desc),
                ) {
                    val backends =
                        viewModel.providers.sortedBy { it.kind == ClientWebProviderKind.Native }
                    backends.forEachIndexed { index, provider ->
                        if (index > 0) HorizontalDivider(color = LemmaTheme.colors.border)
                        WebProviderBackend(
                            provider = provider,
                            apiKey = viewModel.apiKey(provider.id),
                            hasUnsavedKey = viewModel.hasUnsavedKey(provider.id),
                            saving = viewModel.isSaving(provider.id),
                            onEnabledChange = { viewModel.setEnabled(provider.id, it) },
                            onApiKeyChange = { viewModel.setApiKey(provider.id, it) },
                            onSaveApiKey = { viewModel.saveApiKey(provider.id) },
                            onDiscardApiKey = { viewModel.discardApiKey(provider.id) },
                        )
                    }
                }
                WebProviderOrder(
                    title = stringResource(Res.string.provider_web_search_order),
                    description = stringResource(Res.string.provider_web_search_order_desc),
                    providers = viewModel.searchProviders,
                    onMove = { id, direction ->
                        viewModel.move(ClientWebFunction.Search, id, direction)
                    },
                )
                WebProviderOrder(
                    title = stringResource(Res.string.provider_web_fetch_order),
                    description = stringResource(Res.string.provider_web_fetch_order_desc),
                    providers = viewModel.fetchProviders,
                    onMove = { id, direction ->
                        viewModel.move(ClientWebFunction.Fetch, id, direction)
                    },
                )
            }
        }
    }
}

@Composable
private fun WebProviderBackend(
    provider: ClientWebProvider,
    apiKey: String,
    hasUnsavedKey: Boolean,
    saving: Boolean,
    onEnabledChange: (Boolean) -> Unit,
    onApiKeyChange: (String) -> Unit,
    onSaveApiKey: () -> Unit,
    onDiscardApiKey: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = provider.name,
            style = LemmaTheme.typography.title,
            color = LemmaTheme.colors.foreground,
            modifier = Modifier.padding(start = 16.dp, top = 16.dp, end = 16.dp),
        )
        ProviderEnabledRow(
            enabled = provider.enabled,
            onChange = onEnabledChange,
            interactionEnabled =
                !saving &&
                    (provider.enabled ||
                        provider.kind == ClientWebProviderKind.Native ||
                        provider.apiKey.isNotBlank()),
            hint =
                if (provider.kind == ClientWebProviderKind.Native || provider.apiKey.isNotBlank())
                    null
                else stringResource(Res.string.provider_enable_needs_key),
            label = stringResource(Res.string.provider_enable_web_provider, provider.name),
        )
        if (provider.kind == ClientWebProviderKind.Native) {
            Text(
                text = stringResource(Res.string.provider_web_native_desc),
                style = LemmaTheme.typography.body,
                color = LemmaTheme.colors.mutedForeground,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            )
        } else {
            LemmaField(
                label = stringResource(Res.string.provider_api_key),
                description = stringResource(Res.string.provider_api_key_desc),
                modifier = Modifier.padding(horizontal = 16.dp),
            ) {
                LemmaPasswordField(
                    value = apiKey,
                    onValueChange = onApiKeyChange,
                    placeholder = stringResource(Res.string.provider_api_key_placeholder),
                    enabled = !saving,
                )
            }
            if (hasUnsavedKey) {
                SaveBar(
                    message = stringResource(Res.string.provider_unsaved_changes),
                    busy = saving,
                    saveEnabled = true,
                    onSave = onSaveApiKey,
                    onCancel = onDiscardApiKey,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    }
}
