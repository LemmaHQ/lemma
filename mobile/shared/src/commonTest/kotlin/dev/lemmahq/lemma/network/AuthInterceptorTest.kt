package dev.lemmahq.lemma.network

import com.russhwolf.settings.MapSettings
import dev.lemmahq.gen.lemma.v1.RefreshRequest
import dev.lemmahq.gen.lemma.v1.authTokens
import dev.lemmahq.gen.lemma.v1.refreshResponse
import dev.lemmahq.lemma.data.DefaultSettingsRepository
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer

private const val BASE = "http://engine.lemma.invalid"

class AuthInterceptorTest {

    private val settings = DefaultSettingsRepository(MapSettings())
    private val seen = mutableListOf<Request>()

    private fun client(answer: (Request) -> Response): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(settings))
            .addInterceptor(
                Interceptor { chain ->
                    seen += chain.request()
                    answer(chain.request())
                }
            )
            .build()

    private fun call(client: OkHttpClient, method: String): Response =
        client
            .newCall(
                Request.Builder()
                    .url("$BASE/lemma.v1.$method")
                    .post("{}".toRequestBody("application/json".toMediaType()))
                    .build()
            )
            .execute()

    @Test
    fun sendsTheStoredAccessToken() {
        settings.setAccessToken("access-1")
        val response = call(client { respond(it, 200) }, "ProviderService/ListProviders")

        assertEquals(200, response.code)
        assertEquals("Bearer access-1", seen.single().header("Authorization"))
    }

    @Test
    fun rotatesTheTokenPairOnceAndResendsTheRequest() {
        settings.setAccessToken("access-1")
        settings.setRefreshToken("refresh-1")
        val client = client { request ->
            when {
                request.url.encodedPath == "/lemma.v1.AuthService/Refresh" ->
                    rotated(request, "refresh-1")
                request.header("Authorization") == "Bearer access-2" -> respond(request, 200)
                else -> respond(request, 401)
            }
        }

        val response = call(client, "ProviderService/ListProviders")

        assertEquals(200, response.code)
        assertEquals(
            listOf(
                "/lemma.v1.ProviderService/ListProviders",
                "/lemma.v1.AuthService/Refresh",
                "/lemma.v1.ProviderService/ListProviders",
            ),
            seen.map { it.url.encodedPath },
        )
        assertEquals("{}", Buffer().also { seen.last().body!!.writeTo(it) }.readUtf8())
        assertEquals("access-2", settings.getAccessToken())
        assertEquals("refresh-2", settings.getRefreshToken())
    }

    @Test
    fun aFailedRotationClearsTheSessionAndReturnsThe401() {
        settings.setAccessToken("access-1")
        settings.setRefreshToken("refresh-1")
        val client = client { respond(it, 401) }

        val response = call(client, "ProviderService/ListProviders")

        assertEquals(401, response.code)
        assertEquals(2, seen.size)
        assertNull(settings.getAccessToken())
        assertNull(settings.getRefreshToken())
    }

    @Test
    fun anAuthServiceRejectionIsReturnedWithoutRotation() {
        settings.setRefreshToken("refresh-1")
        val response = call(client { respond(it, 401) }, "AuthService/Login")

        assertEquals(401, response.code)
        assertEquals(1, seen.size)
        assertEquals("refresh-1", settings.getRefreshToken())
    }
}

private fun respond(request: Request, code: Int): Response =
    Response.Builder()
        .request(request)
        .protocol(Protocol.HTTP_1_1)
        .code(code)
        .message("")
        .body("{}".toResponseBody("application/json".toMediaType()))
        .build()

private fun rotated(request: Request, expectedRefreshToken: String): Response {
    val sent =
        RefreshRequest.parseFrom(Buffer().also { request.body!!.writeTo(it) }.readByteArray())
    assertEquals(expectedRefreshToken, sent.refreshToken)
    val body = refreshResponse {
        tokens = authTokens {
            accessToken = "access-2"
            refreshToken = "refresh-2"
        }
    }
    return Response.Builder()
        .request(request)
        .protocol(Protocol.HTTP_1_1)
        .code(200)
        .message("")
        .body(body.toByteArray().toResponseBody("application/proto".toMediaType()))
        .build()
}
