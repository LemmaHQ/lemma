package io.github.mistvesper.lemma.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaSettingsGroup
import io.github.mistvesper.lemma.ui.components.LemmaSettingsRow
import io.github.mistvesper.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_settings
import lemma.mobile.shared.generated.resources.icon_bot
import lemma.mobile.shared.generated.resources.icon_palette
import lemma.mobile.shared.generated.resources.icon_search
import lemma.mobile.shared.generated.resources.settings_ai_providers
import lemma.mobile.shared.generated.resources.settings_appearance
import lemma.mobile.shared.generated.resources.settings_group_agent
import lemma.mobile.shared.generated.resources.settings_group_general
import lemma.mobile.shared.generated.resources.settings_web
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun SettingsScreen(
    onAppearance: () -> Unit,
    onProviders: () -> Unit,
    onWebProviders: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(title = stringResource(Res.string.common_settings), onBack = onBack)
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            LemmaSettingsGroup(label = stringResource(Res.string.settings_group_general)) {
                LemmaSettingsRow(
                    icon = Res.drawable.icon_palette,
                    title = stringResource(Res.string.settings_appearance),
                    onClick = onAppearance,
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            LemmaSettingsGroup(label = stringResource(Res.string.settings_group_agent)) {
                LemmaSettingsRow(
                    icon = Res.drawable.icon_bot,
                    title = stringResource(Res.string.settings_ai_providers),
                    onClick = onProviders,
                )
                LemmaSettingsRow(
                    icon = Res.drawable.icon_search,
                    title = stringResource(Res.string.settings_web),
                    onClick = onWebProviders,
                )
            }
        }
    }
}
