package io.github.mistvesper.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ClientPredefinedProvider
import io.github.mistvesper.lemma.client.ClientProvider
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaIconButton
import io.github.mistvesper.lemma.ui.components.LemmaSettingsGroup
import io.github.mistvesper.lemma.ui.components.LemmaSwitch
import io.github.mistvesper.lemma.ui.components.LemmaTextField
import io.github.mistvesper.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_chevron_right
import lemma.mobile.shared.generated.resources.icon_plus
import lemma.mobile.shared.generated.resources.icon_search
import lemma.mobile.shared.generated.resources.provider_custom_group
import lemma.mobile.shared.generated.resources.provider_empty_list
import lemma.mobile.shared.generated.resources.provider_new_provider
import lemma.mobile.shared.generated.resources.provider_predefined_group
import lemma.mobile.shared.generated.resources.provider_search_placeholder
import lemma.mobile.shared.generated.resources.settings_ai_providers
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun ProviderListScreen(
    viewModel: ProviderViewModel,
    onBack: () -> Unit,
    onOpen: (String) -> Unit,
    onNew: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(title = stringResource(Res.string.settings_ai_providers), onBack = onBack) {
            LemmaIconButton(
                icon = Res.drawable.icon_plus,
                contentDescription = stringResource(Res.string.provider_new_provider),
                onClick = onNew,
            )
        }
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            LemmaTextField(
                value = viewModel.query,
                onValueChange = { viewModel.query = it },
                placeholder = stringResource(Res.string.provider_search_placeholder),
                leadingIcon = Res.drawable.icon_search,
            )
            Spacer(modifier = Modifier.height(20.dp))
            viewModel.error?.let { error ->
                Text(
                    text = error.text(),
                    style = LemmaTheme.typography.body,
                    color = LemmaTheme.colors.destructive,
                )
            }
            when {
                viewModel.loading ->
                    CircularProgressIndicator(
                        color = LemmaTheme.colors.brand,
                        modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally),
                    )
                viewModel.providers.isEmpty() && viewModel.error == null ->
                    Text(
                        text = stringResource(Res.string.provider_empty_list),
                        style = LemmaTheme.typography.body,
                        color = LemmaTheme.colors.subtleForeground,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    )
                else -> {
                    val (predefined, custom) =
                        viewModel.matches.partition { it.source is ClientPredefinedProvider }
                    ProviderGroup(
                        label = stringResource(Res.string.provider_predefined_group),
                        providers = predefined,
                        onOpen = onOpen,
                    )
                    if (predefined.isNotEmpty() && custom.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(24.dp))
                    }
                    ProviderGroup(
                        label = stringResource(Res.string.provider_custom_group),
                        providers = custom,
                        onOpen = onOpen,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProviderGroup(
    label: String,
    providers: List<ClientProvider>,
    onOpen: (String) -> Unit,
) {
    if (providers.isEmpty()) return
    LemmaSettingsGroup(label = label) {
        providers.forEachIndexed { index, provider ->
            if (index > 0) {
                HorizontalDivider(
                    color = LemmaTheme.colors.border,
                    modifier = Modifier.padding(start = 60.dp),
                )
            }
            ProviderRow(provider = provider, onClick = { onOpen(provider.id) })
        }
    }
}

@Composable
private fun ProviderRow(provider: ClientProvider, onClick: () -> Unit) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(LemmaTheme.colors.card),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = (provider.source.name.firstOrNull() ?: '?').uppercase(),
                style = LemmaTheme.typography.body,
                color = LemmaTheme.colors.cardForeground,
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = provider.source.name,
            style = LemmaTheme.typography.body,
            color = LemmaTheme.colors.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        LemmaSwitch(checked = provider.enabled, onCheckedChange = null, enabled = false)
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
            painter = painterResource(Res.drawable.icon_chevron_right),
            contentDescription = null,
            tint = LemmaTheme.colors.subtleForeground,
            modifier = Modifier.size(20.dp),
        )
    }
}
