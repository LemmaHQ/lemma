package dev.lemmahq.lemma.ui.provider

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
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaField
import dev.lemmahq.lemma.ui.components.LemmaTextField
import dev.lemmahq.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_identifier
import lemma.mobile.shared.generated.resources.provider_identifier_hint
import lemma.mobile.shared.generated.resources.provider_identifier_placeholder
import lemma.mobile.shared.generated.resources.provider_name
import lemma.mobile.shared.generated.resources.provider_name_description
import lemma.mobile.shared.generated.resources.provider_name_placeholder
import lemma.mobile.shared.generated.resources.provider_new
import lemma.mobile.shared.generated.resources.provider_new_hint
import lemma.mobile.shared.generated.resources.provider_type
import lemma.mobile.shared.generated.resources.provider_type_description
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
        LemmaTopBar(title = stringResource(Res.string.provider_new), onBack = onBack)
        Column(
            modifier =
                Modifier.weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            LemmaField(
                label = stringResource(Res.string.provider_type),
                description = stringResource(Res.string.provider_type_description),
            ) {
                ProviderKindPicker(kind = viewModel.kind, onSelect = { viewModel.kind = it })
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
                description = stringResource(Res.string.provider_name_description),
            ) {
                LemmaTextField(
                    value = viewModel.name,
                    onValueChange = { viewModel.name = it },
                    placeholder = stringResource(Res.string.provider_name_placeholder),
                )
            }
            ProviderConnectionFields(
                kind = viewModel.kind,
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
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.danger,
                )
            }
        }
        SaveBar(
            message = stringResource(Res.string.provider_new_hint),
            busy = viewModel.saving,
            saveEnabled = !viewModel.baseUrlInvalid,
            onSave = viewModel::save,
            onCancel = onBack,
        )
    }
}
