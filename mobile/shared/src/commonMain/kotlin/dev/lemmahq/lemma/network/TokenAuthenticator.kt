package dev.lemmahq.lemma.network

import dev.lemmahq.lemma.data.SettingsRepository
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import org.json.JSONObject

class TokenAuthenticator(
    private val host: String,
    private val settingsRepository: SettingsRepository
) : Authenticator {

    private val refreshClient = OkHttpClient()

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) {
            return null
        }

        if (response.request.url.encodedPath.contains("AuthService/")) {
            return null
        }

        val refreshToken = settingsRepository.getRefreshToken() ?: return null

        synchronized(this) {
            val currentAccessToken = settingsRepository.getAccessToken()
            val requestHeaderToken = response.request.header("Authorization")?.removePrefix("Bearer ")

            if (currentAccessToken != null && currentAccessToken != requestHeaderToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentAccessToken")
                    .build()
            }

            val refreshed = runBlocking {
                tryRefresh(refreshToken)
            }

            return if (refreshed != null) {
                response.request.newBuilder()
                    .header("Authorization", "Bearer $refreshed")
                    .build()
            } else {
                settingsRepository.clearAuth()
                null
            }
        }
    }

    private fun tryRefresh(refreshToken: String): String? {
        val refreshUrl = host.trimEnd('/') + "/lemma.v1.AuthService/Refresh"
        val jsonPayload = JSONObject().apply {
            put("refreshToken", refreshToken)
        }.toString()

        val request = Request.Builder()
            .url(refreshUrl)
            .post(jsonPayload.toRequestBody("application/json".toMediaType()))
            .build()

        return try {
            val res = refreshClient.newCall(request).execute()
            if (res.isSuccessful) {
                val bodyStr = res.body?.string() ?: return null
                val jsonObj = JSONObject(bodyStr)
                val tokensObj = jsonObj.optJSONObject("tokens") ?: return null
                val newAccessToken = tokensObj.optString("accessToken")
                val newRefreshToken = tokensObj.optString("refreshToken")

                if (newAccessToken.isNotBlank()) {
                    settingsRepository.setAccessToken(newAccessToken)
                    if (newRefreshToken.isNotBlank()) {
                        settingsRepository.setRefreshToken(newRefreshToken)
                    }
                    newAccessToken
                } else {
                    null
                }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun responseCount(response: Response): Int {
        var result = 1
        var prior = response.priorResponse
        while (prior != null) {
            result++
            prior = prior.priorResponse
        }
        return result
    }
}
