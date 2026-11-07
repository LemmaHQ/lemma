package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.navigationevent.NavigationEventInfo
import androidx.navigationevent.compose.NavigationBackHandler
import androidx.navigationevent.compose.rememberNavigationEventState
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaConfirmDialog
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenu
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenuItem
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import dev.lemmahq.lemma.ui.components.LemmaSwitch
import dev.lemmahq.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_cancel
import lemma.mobile.shared.generated.resources.common_delete
import lemma.mobile.shared.generated.resources.icon_ellipsis_vertical
import lemma.mobile.shared.generated.resources.icon_settings
import lemma.mobile.shared.generated.resources.icon_trash_2
import lemma.mobile.shared.generated.resources.provider_delete
import lemma.mobile.shared.generated.resources.provider_delete_description
import lemma.mobile.shared.generated.resources.provider_delete_title
import lemma.mobile.shared.generated.resources.provider_discard
import lemma.mobile.shared.generated.resources.provider_discard_description
import lemma.mobile.shared.generated.resources.provider_discard_title
import lemma.mobile.shared.generated.resources.provider_enable
import lemma.mobile.shared.generated.resources.provider_keep_editing
import lemma.mobile.shared.generated.resources.provider_more_actions
import lemma.mobile.shared.generated.resources.provider_settings_title
import lemma.mobile.shared.generated.resources.provider_unsaved_changes
import org.jetbrains.compose.resources.stringResource

/** The page of one provider; leaving it with unsaved connection changes asks to discard them. */
@Composable
internal fun ProviderDetailScreen(
    viewModel: ProviderDetailViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val provider = viewModel.provider
    var menuOpen by remember { mutableStateOf(false) }
    var confirmingDelete by rememberSaveable { mutableStateOf(false) }
    var confirmingDiscard by rememberSaveable { mutableStateOf(false) }

    NavigationBackHandler(
        state = rememberNavigationEventState(NavigationEventInfo.None),
        isBackEnabled = viewModel.dirty,
        onBackCompleted = { confirmingDiscard = true },
    )

    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(
            title = provider.name,
            onBack = { if (viewModel.dirty) confirmingDiscard = true else onBack() },
        ) {
            Box {
                LemmaIconButton(
                    icon = Res.drawable.icon_ellipsis_vertical,
                    contentDescription = stringResource(Res.string.provider_more_actions),
                    onClick = { menuOpen = true },
                )
                LemmaDropdownMenu(expanded = menuOpen, onDismiss = { menuOpen = false }) {
                    LemmaDropdownMenuItem(
                        title = stringResource(Res.string.provider_settings_title),
                        icon = Res.drawable.icon_settings,
                        onClick = {
                            menuOpen = false
                            viewModel.openSettings()
                        },
                    )
                    LemmaDropdownMenuItem(
                        title = stringResource(Res.string.provider_delete),
                        icon = Res.drawable.icon_trash_2,
                        destructive = true,
                        onClick = {
                            menuOpen = false
                            confirmingDelete = true
                        },
                    )
                }
            }
        }
        viewModel.error?.let { error ->
            Text(
                text = error.text(),
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.danger,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        Column(
            modifier =
                Modifier.weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            EnabledRow(enabled = provider.enabled, onChange = viewModel::setEnabled)
            ProviderConnectionFields(
                kind = provider.kind,
                apiKey = viewModel.apiKey,
                onApiKeyChange = { viewModel.apiKey = it },
                baseUrl = viewModel.baseUrl,
                onBaseUrlChange = { viewModel.baseUrl = it },
                apiPath = viewModel.apiPath,
                onApiPathChange = { viewModel.apiPath = it },
            )
            ConnectionCheckField(
                models = provider.models,
                model = viewModel.checkModel,
                result = viewModel.checkResult,
                enabled = viewModel.baseUrlValid,
                onPickModel = { viewModel.pickedCheckModel = it },
                onCheck = viewModel::check,
            )
            ModelListSection(
                models = provider.models,
                fetching = viewModel.fetching,
                onFetch = viewModel::fetchModels,
                onAdd = viewModel::addModel,
                onRemove = viewModel::removeModel,
            )
        }
        if (viewModel.dirty) {
            SaveBar(
                message = stringResource(Res.string.provider_unsaved_changes),
                busy = viewModel.saving,
                saveEnabled = viewModel.baseUrlValid,
                onSave = viewModel::save,
                onCancel = viewModel::discardEdits,
            )
        }
    }

    viewModel.nameDraft?.let { name ->
        ProviderSettingsDialog(
            identifier = provider.identifier,
            name = name,
            onNameChange = { viewModel.nameDraft = it },
            error = viewModel.nameError?.text(),
            saveEnabled = viewModel.nameChanged && !viewModel.renaming,
            onSave = viewModel::saveName,
            onDismiss = viewModel::closeSettings,
        )
    }
    if (confirmingDelete) {
        LemmaConfirmDialog(
            title = stringResource(Res.string.provider_delete_title),
            description = stringResource(Res.string.provider_delete_description),
            confirmLabel = stringResource(Res.string.common_delete),
            dismissLabel = stringResource(Res.string.common_cancel),
            destructive = true,
            onConfirm = {
                confirmingDelete = false
                viewModel.delete()
            },
            onDismiss = { confirmingDelete = false },
        )
    }
    if (confirmingDiscard) {
        LemmaConfirmDialog(
            title = stringResource(Res.string.provider_discard_title),
            description = stringResource(Res.string.provider_discard_description),
            confirmLabel = stringResource(Res.string.provider_discard),
            dismissLabel = stringResource(Res.string.provider_keep_editing),
            destructive = true,
            onConfirm = {
                confirmingDiscard = false
                viewModel.discardEdits()
                onBack()
            },
            onDismiss = { confirmingDiscard = false },
        )
    }
    viewModel.fetched?.let { remote ->
        ModelPickDialog(
            remote = remote,
            existing = provider.models,
            onAdd = viewModel::addFetched,
            onDismiss = viewModel::dismissFetched,
        )
    }
}

@Composable
private fun EnabledRow(enabled: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(LemmaTheme.shapes.medium)
                .background(LemmaTheme.colors.fill2)
                .toggleable(value = enabled, role = Role.Switch, onValueChange = onChange)
                .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(Res.string.provider_enable),
            style = LemmaTheme.typography.bodyLarge,
            color = LemmaTheme.colors.textPrimary,
            modifier = Modifier.weight(1f),
        )
        LemmaSwitch(checked = enabled, onCheckedChange = null)
    }
}
