package io.github.mistvesper.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.settings_ai_providers
import org.jetbrains.compose.resources.stringResource

/** The page a provider shows while the provider list loads. */
@Composable
internal fun ProviderLoadingScreen(onBack: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
        LemmaTopBar(title = stringResource(Res.string.settings_ai_providers), onBack = onBack)
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = LemmaTheme.colors.brand)
        }
    }
}
