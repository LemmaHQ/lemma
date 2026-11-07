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
private val HTTP_CLIENT_ERRORS = 400..499
private val PROTO = "application/proto".toMediaType()

/**
 * Sends the stored access token with every request. When a request outside `AuthService` returns
 * 401, rotates the token pair once and resends it. A 4xx refresh response clears the pair and
 * returns the original 401; an I/O failure or 5xx response keeps the pair and throws [IOException].
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
            try {
                synchronized(this) {
                    settings.getAccessToken().takeIf { it != sent } ?: rotate(chain)
                }
            } catch (e: IOException) {
                response.close()
                throw e
            } ?: return response
        response.close()
        return chain.proceed(request.withToken(token))
    }

    private fun rotate(chain: Interceptor.Chain): String? {
        val refreshToken = settings.getRefreshToken() ?: return null
        val url = chain.request().url
        val rotation =
            Request.Builder()
                .url(
                    url.newBuilder()
                        .setPathSegment(url.pathSize - 2, "lemma.v1.AuthService")
                        .setPathSegment(url.pathSize - 1, "Refresh")
                        .query(null)
                        .build()
                )
                .header("connect-protocol-version", "1")
                .post(
                    refreshRequest { this.refreshToken = refreshToken }
                        .toByteArray()
                        .toRequestBody(PROTO)
                )
                .build()
        chain.proceed(rotation).use { response ->
            if (!response.isSuccessful) {
                if (response.code in HTTP_CLIENT_ERRORS) {
                    settings.clearAuth()
                    return null
                }
                throw IOException("AuthService/Refresh failed with HTTP ${response.code}")
            }
            val tokens = RefreshResponse.parseFrom(response.body.bytes()).tokens
            settings.setTokens(tokens.accessToken, tokens.refreshToken)
            return tokens.accessToken
        }
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
