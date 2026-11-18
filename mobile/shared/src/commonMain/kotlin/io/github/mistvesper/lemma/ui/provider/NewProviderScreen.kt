package io.github.mistvesper.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ApiFormat
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaField
import io.github.mistvesper.lemma.ui.components.LemmaTextField
import io.github.mistvesper.lemma.ui.components.LemmaTopBar
import io.github.mistvesper.lemma.ui.components.SaveBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_api_format
import lemma.mobile.shared.generated.resources.provider_api_format_desc
import lemma.mobile.shared.generated.resources.provider_identifier
import lemma.mobile.shared.generated.resources.provider_identifier_hint
import lemma.mobile.shared.generated.resources.provider_identifier_placeholder
import lemma.mobile.shared.generated.resources.provider_name
import lemma.mobile.shared.generated.resources.provider_name_desc
import lemma.mobile.shared.generated.resources.provider_name_placeholder
import lemma.mobile.shared.generated.resources.provider_new_provider
import lemma.mobile.shared.generated.resources.provider_new_provider_hint
import org.jetbrains.compose.resources.stringResource

/** The page creating a provider; [onOpenProvider] receives the ID of the stored provider. */
@Composable
internal fun NewProviderScreen(
    viewModel: NewProviderViewModel,
    onBack: () -> Unit,
    onOpenProvider: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val created = viewModel.created
    SideEffect(created) { created?.let { onOpenProvider(it.id) } }

    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(title = stringResource(Res.string.provider_new_provider), onBack = onBack)
        Column(
            modifier =
                Modifier.weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            LemmaField(
                label = stringResource(Res.string.provider_api_format),
                description = stringResource(Res.string.provider_api_format_desc),
            ) {
                ApiFormatPicker(
                    apiFormat = viewModel.apiFormat,
                    options = ApiFormat.entries,
                    onSelect = { viewModel.apiFormat = it },
                )
            }
            LemmaField(
                label = stringResource(Res.string.provider_identifier),
                description = stringResource(Res.string.provider_identifier_hint),
            ) {
                LemmaTextField(
                    value = viewModel.identifier,
                    onValueChange = { viewModel.identifier = it },
                    placeholder = stringResource(Res.string.provider_identifier_placeholder),
                )
            }
            LemmaField(
                label = stringResource(Res.string.provider_name),
                description = stringResource(Res.string.provider_name_desc),
            ) {
                LemmaTextField(
                    value = viewModel.name,
                    onValueChange = { viewModel.name = it },
                    placeholder = stringResource(Res.string.provider_name_placeholder),
                )
            }
            ProviderConnectionFields(
                apiFormat = viewModel.apiFormat,
                apiKey = viewModel.apiKey,
                onApiKeyChange = { viewModel.apiKey = it },
                baseUrl = viewModel.baseUrl,
                onBaseUrlChange = { viewModel.baseUrl = it },
                apiPath = viewModel.apiPath,
                onApiPathChange = { viewModel.apiPath = it },
            )
            viewModel.error?.let { error ->
                Text(
                    text = error.text(),
                    style = LemmaTheme.typography.body,
                    color = LemmaTheme.colors.destructive,
                )
            }
        }
        SaveBar(
            message = stringResource(Res.string.provider_new_provider_hint),
            busy = viewModel.saving,
            saveEnabled = !viewModel.baseUrlInvalid,
            onSave = viewModel::save,
            onCancel = onBack,
        )
    }
}
