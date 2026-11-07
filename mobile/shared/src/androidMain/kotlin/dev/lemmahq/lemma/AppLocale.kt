package dev.lemmahq.lemma

import android.content.res.Configuration
import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidedValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalResources
import java.util.Locale

@Composable
internal actual fun appLocale(tag: String?): ProvidedValue<*> {
    val locale = tag?.let(Locale::forLanguageTag) ?: Resources.getSystem().configuration.locales[0]
    Locale.setDefault(locale)
    val configuration = Configuration(LocalConfiguration.current).apply { setLocale(locale) }
    val resources = LocalResources.current
    @Suppress("DEPRECATION") resources.updateConfiguration(configuration, resources.displayMetrics)
    return LocalConfiguration.provides(configuration)
}
