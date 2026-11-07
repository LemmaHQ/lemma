package dev.lemmahq.lemma.ui.provider

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
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import dev.lemmahq.lemma.ui.components.LemmaSettingsGroup
import dev.lemmahq.lemma.ui.components.LemmaTextField
import dev.lemmahq.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_chevron_right
import lemma.mobile.shared.generated.resources.icon_plus
import lemma.mobile.shared.generated.resources.icon_search
import lemma.mobile.shared.generated.resources.provider_disabled_group
import lemma.mobile.shared.generated.resources.provider_empty
import lemma.mobile.shared.generated.resources.provider_enabled_group
import lemma.mobile.shared.generated.resources.provider_new
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
                contentDescription = stringResource(Res.string.provider_new),
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
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.danger,
                )
            }
            when {
                viewModel.loading ->
                    CircularProgressIndicator(
                        color = LemmaTheme.colors.primary,
                        modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally),
                    )
                viewModel.providers.isEmpty() && viewModel.error == null ->
                    Text(
                        text = stringResource(Res.string.provider_empty),
                        style = LemmaTheme.typography.bodyMedium,
                        color = LemmaTheme.colors.textTertiary,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    )
                else -> {
                    val (enabled, disabled) = viewModel.matches.partition { it.enabled }
                    ProviderGroup(
                        label = stringResource(Res.string.provider_enabled_group),
                        providers = enabled,
                        onOpen = onOpen,
                    )
                    if (enabled.isNotEmpty() && disabled.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(24.dp))
                    }
                    ProviderGroup(
                        label = stringResource(Res.string.provider_disabled_group),
                        providers = disabled,
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
                    color = LemmaTheme.colors.separator,
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
            modifier =
                Modifier.size(32.dp)
                    .clip(LemmaTheme.shapes.full)
                    .background(LemmaTheme.colors.fill3),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = (provider.name.firstOrNull() ?: '?').uppercase(),
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textPrimary,
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = provider.name,
            style = LemmaTheme.typography.bodyLarge,
            color = LemmaTheme.colors.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Icon(
            painter = painterResource(Res.drawable.icon_chevron_right),
            contentDescription = null,
            tint = LemmaTheme.colors.textTertiary,
            modifier = Modifier.size(20.dp),
        )
    }
}
