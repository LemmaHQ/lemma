package dev.lemmahq.lemma.network

import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.data.DefaultSettingsRepository
import kotlin.test.Test
import kotlin.test.assertNull
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response

class TokenAuthenticatorTest {

    @Test
    fun returnsNullWhenNoRefreshToken() {
        val repo = DefaultSettingsRepository(MapSettings())
        val authenticator = TokenAuthenticator("http://127.0.0.1:1025", repo)

        val request = Request.Builder()
            .url("http://127.0.0.1:1025/lemma.v1.ConversationService/ListConversations")
            .header("Authorization", "Bearer expired_token")
            .build()

        val response = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retryRequest = authenticator.authenticate(null, response)
        assertNull(retryRequest)
    }

    @Test
    fun returnsNullForAuthServiceCalls() {
        val repo = DefaultSettingsRepository(MapSettings())
        repo.setRefreshToken("sample_refresh_token")
        val authenticator = TokenAuthenticator("http://127.0.0.1:1025", repo)

        val request = Request.Builder()
            .url("http://127.0.0.1:1025/lemma.v1.AuthService/Login")
            .build()

        val response = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retryRequest = authenticator.authenticate(null, response)
        assertNull(retryRequest)
    }
}
