package dev.lemmahq.lemma

import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalConfiguration

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val application = application as LemmaApplication
        setContent {
            val theme by application.settings.theme.collectAsState()
            val uiMode = LocalConfiguration.current.uiMode and Configuration.UI_MODE_NIGHT_MASK
            val dark = theme.isDark(uiMode == Configuration.UI_MODE_NIGHT_YES)
            SideEffect {
                enableEdgeToEdge(
                    statusBarStyle =
                        SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark },
                    navigationBarStyle =
                        SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark },
                )
            }
            App(
                settings = application.settings,
                messageCache = application.messageCache,
                connector = application.connector,
                appVersion = BuildConfig.VERSION_NAME,
            )
        }
    }
}
