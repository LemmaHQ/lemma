package dev.lemmahq.lemma

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.remember
import dev.lemmahq.lemma.data.DriverFactory
import dev.lemmahq.lemma.data.LocalChatRepository
import dev.lemmahq.lemma.db.LemmaDatabase
import dev.lemmahq.lemma.engine.LocalEngine

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            val repo = remember {
                val driver = DriverFactory(applicationContext).createDriver()
                val db = LemmaDatabase(driver)
                LocalChatRepository(db)
            }
            App(
                localChatRepository = repo,
                localRpc = { settings ->
                    LocalEngine.client(applicationContext, settings)
                },
            )
        }
    }
}
