package dev.lemmahq.lemma

import android.app.Application
import com.russhwolf.settings.SharedPreferencesSettings
import dev.lemmahq.lemma.data.DriverFactory
import dev.lemmahq.lemma.data.KeystoreTokenStore
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.db.LemmaDatabase
import dev.lemmahq.lemma.network.AndroidConnector

/** Holds the settings, message cache, and connector that every activity of the process shares. */
class LemmaApplication : Application() {

    val settings by lazy {
        SettingsRepository(
            SharedPreferencesSettings(
                getSharedPreferences("${packageName}_preferences", MODE_PRIVATE)
            ),
            KeystoreTokenStore(this),
        )
    }

    val messageCache by lazy {
        LocalMessageRepository(LemmaDatabase(DriverFactory(this).createDriver()))
    }

    val connector by lazy { AndroidConnector(filesDir.absolutePath, settings) }
}
