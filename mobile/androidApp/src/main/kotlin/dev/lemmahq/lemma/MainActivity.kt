package dev.lemmahq.lemma

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.tooling.preview.Preview
import dev.lemmahq.lemma.data.DriverFactory
import dev.lemmahq.lemma.data.SqlDelightLocalChatRepository
import dev.lemmahq.lemma.db.LemmaDatabase
import dev.lemmahq.lemma.engine.LocalLemmaClient

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            val repo = remember {
                val driver = DriverFactory(applicationContext).createDriver()
                val db = LemmaDatabase(driver)
                SqlDelightLocalChatRepository(db)
            }
            App(
                localChatRepository = repo,
                localClientFactory = { settings ->
                    LocalLemmaClient.create(applicationContext, settings)
                },
            )
        }
    }
}

@Preview
@Composable
fun AppAndroidPreview() {
    App()
}
