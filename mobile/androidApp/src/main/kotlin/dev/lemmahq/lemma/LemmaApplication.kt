package dev.lemmahq.lemma

import android.app.Application
import com.russhwolf.settings.SharedPreferencesSettings
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.engine.PlatformVerifier
import dev.lemmahq.lemma.network.AndroidEngineOpener

/** Holds the settings and engine opener that every activity of the process shares. */
class LemmaApplication : Application() {

    val settings by lazy {
        SettingsRepository(
            SharedPreferencesSettings(
                getSharedPreferences("${packageName}_preferences", MODE_PRIVATE)
            )
        )
    }

    val engineOpener by lazy { AndroidEngineOpener(filesDir.absolutePath) }

    override fun onCreate() {
        super.onCreate()
        PlatformVerifier.install(this)
    }
}
