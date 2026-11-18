package io.github.mistvesper.lemma.engine

import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okio.Timeout
import org.junit.Rule
import org.junit.rules.TemporaryFolder

class EngineTest {

    @get:Rule val dataDir: TemporaryFolder = TemporaryFolder.builder().assureDeletion().build()

    private lateinit var engine: Engine
    private lateinit var client: OkHttpClient

    @BeforeTest
    fun setUp() {
        engine = runBlocking { Engine.open(dataDir.newFolder().path) }
        client = OkHttpClient.Builder().addInterceptor(engine.transport).build()
    }

    @AfterTest
    fun tearDown() {
        runBlocking { engine.close() }
    }

    @Test
    fun aRequestWithAContentTypeHeaderIsAnsweredWithItsBody() {
        val request =
            Request.Builder()
                .url("$ENGINE_BASE_URL/lemma.v1.ProviderService/ListProviders")
                .header("Content-Type", "application/json")
                .post("{}".toRequestBody("application/json".toMediaType()))
                .build()

        client.newCall(request).execute().use { response ->
            assertEquals(200, response.code)
            assertEquals("application/json".toMediaType(), response.body.contentType())
            assertTrue(response.body.string().startsWith("""{"providers":["""))
        }
    }

    @Test
    fun aRequestWithoutABodyReachesItsPathAndQueryWithoutATimeout() {
        val request = Request.Builder().url("$ENGINE_BASE_URL/missing?probe=1").build()

        client.newCall(request).execute().use { response ->
            assertEquals(404, response.code)
            assertNull(response.body.contentType())
            assertSame(Timeout.NONE, response.body.source().timeout())
        }
    }
}
