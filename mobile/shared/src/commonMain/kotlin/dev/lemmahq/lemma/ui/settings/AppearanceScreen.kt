package dev.lemmahq.lemma.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.data.LanguagePreference
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.data.ThemePreference
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaOptionRow
import dev.lemmahq.lemma.ui.components.LemmaSettingsGroup
import dev.lemmahq.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_moon
import lemma.mobile.shared.generated.resources.icon_sun
import lemma.mobile.shared.generated.resources.icon_sun_moon
import lemma.mobile.shared.generated.resources.language_chinese
import lemma.mobile.shared.generated.resources.language_english
import lemma.mobile.shared.generated.resources.language_system
import lemma.mobile.shared.generated.resources.settings_appearance
import lemma.mobile.shared.generated.resources.settings_language
import lemma.mobile.shared.generated.resources.settings_language_description
import lemma.mobile.shared.generated.resources.settings_theme
import lemma.mobile.shared.generated.resources.settings_theme_description
import lemma.mobile.shared.generated.resources.theme_dark
import lemma.mobile.shared.generated.resources.theme_light
import lemma.mobile.shared.generated.resources.theme_system
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun AppearanceScreen(
    settings: SettingsRepository,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val theme by settings.theme.collectAsState()
    val language by settings.language.collectAsState()
    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(title = stringResource(Res.string.settings_appearance), onBack = onBack)
        Column(
            modifier =
                Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            LemmaSettingsGroup(
                label = stringResource(Res.string.settings_theme),
                description = stringResource(Res.string.settings_theme_description),
            ) {
                LemmaOptionRow(
                    title = stringResource(Res.string.theme_light),
                    icon = Res.drawable.icon_sun,
                    selected = theme == ThemePreference.Light,
                    onClick = { settings.setTheme(ThemePreference.Light) },
                )
                OptionDivider()
                LemmaOptionRow(
                    title = stringResource(Res.string.theme_dark),
                    icon = Res.drawable.icon_moon,
                    selected = theme == ThemePreference.Dark,
                    onClick = { settings.setTheme(ThemePreference.Dark) },
                )
                OptionDivider()
                LemmaOptionRow(
                    title = stringResource(Res.string.theme_system),
                    icon = Res.drawable.icon_sun_moon,
                    selected = theme == ThemePreference.System,
                    onClick = { settings.setTheme(ThemePreference.System) },
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            LemmaSettingsGroup(
                label = stringResource(Res.string.settings_language),
                description = stringResource(Res.string.settings_language_description),
            ) {
                LemmaOptionRow(
                    title = stringResource(Res.string.language_system),
                    selected = language == LanguagePreference.System,
                    onClick = { settings.setLanguage(LanguagePreference.System) },
                )
                OptionDivider()
                LemmaOptionRow(
                    title = stringResource(Res.string.language_chinese),
                    selected = language == LanguagePreference.Chinese,
                    onClick = { settings.setLanguage(LanguagePreference.Chinese) },
                )
                OptionDivider()
                LemmaOptionRow(
                    title = stringResource(Res.string.language_english),
                    selected = language == LanguagePreference.English,
                    onClick = { settings.setLanguage(LanguagePreference.English) },
                )
            }
        }
    }
}

@Composable
private fun OptionDivider() {
    HorizontalDivider(
        color = LemmaTheme.colors.separator,
        thickness = 1.dp,
        modifier = Modifier.padding(start = 16.dp),
    )
}
