package dev.lemmahq.lemma.network

import dev.lemmahq.gen.lemma.v1.RefreshResponse
import dev.lemmahq.gen.lemma.v1.refreshRequest
import dev.lemmahq.lemma.data.SettingsRepository
import java.io.IOException
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.Buffer

private const val HTTP_UNAUTHORIZED = 401
private val PROTO = "application/proto".toMediaType()

/**
 * Sends the stored access token with every request. When a request outside `AuthService` comes back
 * 401, rotates the token pair once through the same chain and resends the request; a failed
 * rotation clears the session and returns the 401.
 */
class AuthInterceptor(private val settings: SettingsRepository) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().buffered()
        val sent = settings.getAccessToken()
        val response = chain.proceed(request.withToken(sent))
        if (
            response.code != HTTP_UNAUTHORIZED ||
                request.url.encodedPath.contains("/lemma.v1.AuthService/")
        ) {
            return response
        }
        val token =
            synchronized(this) { settings.getAccessToken().takeIf { it != sent } ?: rotate(chain) }
                ?: return response
        response.close()
        return chain.proceed(request.withToken(token))
    }

    private fun rotate(chain: Interceptor.Chain): String? {
        val refreshToken = settings.getRefreshToken() ?: return null
        val url = chain.request().url.resolve("../lemma.v1.AuthService/Refresh") ?: return null
        val rotation =
            Request.Builder()
                .url(url)
                .header("connect-protocol-version", "1")
                .post(
                    refreshRequest { this.refreshToken = refreshToken }
                        .toByteArray()
                        .toRequestBody(PROTO)
                )
                .build()
        val tokens =
            try {
                chain.proceed(rotation).use { response ->
                    if (response.isSuccessful) {
                        RefreshResponse.parseFrom(response.body.bytes()).tokens
                    } else {
                        null
                    }
                }
            } catch (_: IOException) {
                null
            }
        if (tokens == null) {
            settings.clearAuth()
            return null
        }
        settings.setAccessToken(tokens.accessToken)
        settings.setRefreshToken(tokens.refreshToken)
        return tokens.accessToken
    }
}

private fun Request.buffered(): Request {
    val body = body ?: return this
    val bytes = Buffer().also { body.writeTo(it) }.readByteArray()
    return newBuilder().method(method, bytes.toRequestBody(body.contentType())).build()
}

private fun Request.withToken(token: String?): Request =
    if (token.isNullOrBlank()) this
    else newBuilder().header("Authorization", "Bearer $token").build()
