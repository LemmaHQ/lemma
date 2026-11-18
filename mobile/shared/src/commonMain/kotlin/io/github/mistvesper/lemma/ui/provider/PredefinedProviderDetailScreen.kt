package io.github.mistvesper.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigationevent.NavigationEventInfo
import androidx.navigationevent.compose.NavigationBackHandler
import androidx.navigationevent.compose.rememberNavigationEventState
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaField
import io.github.mistvesper.lemma.ui.components.LemmaPasswordField
import io.github.mistvesper.lemma.ui.components.LemmaTopBar
import io.github.mistvesper.lemma.ui.components.ProviderEnabledRow
import io.github.mistvesper.lemma.ui.components.ProviderErrorText
import io.github.mistvesper.lemma.ui.components.SaveBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_api_key
import lemma.mobile.shared.generated.resources.provider_api_key_desc
import lemma.mobile.shared.generated.resources.provider_api_key_placeholder
import lemma.mobile.shared.generated.resources.provider_default_api_format
import lemma.mobile.shared.generated.resources.provider_default_api_format_desc
import lemma.mobile.shared.generated.resources.provider_enable_needs_key
import lemma.mobile.shared.generated.resources.provider_unsaved_changes
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun PredefinedProviderDetailScreen(
    viewModel: PredefinedProviderDetailViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val predefined = viewModel.predefined
    var confirmingDiscard by rememberSaveable { mutableStateOf(false) }

    NavigationBackHandler(
        state = rememberNavigationEventState(NavigationEventInfo.None),
        isBackEnabled = viewModel.dirty,
        onBackCompleted = { confirmingDiscard = true },
    )

    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(
            title = predefined.name,
            onBack = { if (viewModel.dirty) confirmingDiscard = true else onBack() },
        )
        ProviderErrorText(viewModel.error)
        Column(
            modifier =
                Modifier.weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            LemmaField(
                label = stringResource(Res.string.provider_api_key),
                description = stringResource(Res.string.provider_api_key_desc),
            ) {
                LemmaPasswordField(
                    value = viewModel.apiKey,
                    onValueChange = { viewModel.apiKey = it },
                    placeholder = stringResource(Res.string.provider_api_key_placeholder),
                )
            }
            ProviderEnabledRow(
                enabled = viewModel.provider.enabled,
                onChange = viewModel::setEnabled,
                interactionEnabled = viewModel.provider.enabled || viewModel.canEnable,
                hint =
                    if (viewModel.canEnable) null
                    else stringResource(Res.string.provider_enable_needs_key),
            )
            LemmaField(
                label = stringResource(Res.string.provider_default_api_format),
                description = stringResource(Res.string.provider_default_api_format_desc),
            ) {
                ApiFormatPicker(
                    apiFormat = predefined.defaultApiFormat,
                    options = predefined.apiFormats,
                    onSelect = viewModel::setDefaultApiFormat,
                )
            }
            ConnectionCheck(
                models = predefined.models.map { it.id },
                model = viewModel.checkModel,
                result = viewModel.checkResult,
                enabled = !viewModel.dirty && viewModel.provider.apiKey.isNotBlank(),
                onPickModel = { viewModel.pickedCheckModel = it },
                onCheck = viewModel::check,
            )
            PredefinedModelList(models = predefined.models)
        }
        if (viewModel.dirty) {
            SaveBar(
                message = stringResource(Res.string.provider_unsaved_changes),
                busy = viewModel.saving,
                saveEnabled = true,
                onSave = viewModel::save,
                onCancel = viewModel::discardEdits,
            )
        }
    }

    ProviderDiscardDialog(
        open = confirmingDiscard,
        onDiscard = {
            confirmingDiscard = false
            viewModel.discardEdits()
            onBack()
        },
        onDismiss = { confirmingDiscard = false },
    )
}
