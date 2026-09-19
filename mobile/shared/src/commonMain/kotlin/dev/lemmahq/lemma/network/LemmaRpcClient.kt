package dev.lemmahq.lemma.network

import com.connectrpc.Headers
import com.connectrpc.Interceptor
import com.connectrpc.ProtocolClientConfig
import com.connectrpc.StreamFunction
import com.connectrpc.UnaryFunction
import com.connectrpc.extensions.GoogleJavaLiteProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import dev.lemmahq.gen.lemma.v1.AuthServiceClient
import dev.lemmahq.gen.lemma.v1.ChatServiceClient
import dev.lemmahq.gen.lemma.v1.ConversationServiceClient
import dev.lemmahq.gen.lemma.v1.ProviderServiceClient
import dev.lemmahq.gen.lemma.v1.StorageServiceClient
import dev.lemmahq.gen.lemma.v1.SyncServiceClient
import dev.lemmahq.lemma.data.SettingsRepository
import kotlinx.coroutines.Dispatchers
import okhttp3.OkHttpClient

class LemmaRpcClient(
    val host: String,
    private val tokenProvider: () -> String? = { null },
    private val settingsRepository: SettingsRepository? = null
) {
    private val okHttpClient = ConnectOkHttpClient.configureClient(
        OkHttpClient.Builder().apply {
            if (settingsRepository != null) {
                authenticator(TokenAuthenticator(host, settingsRepository))
            }
        }
    ).build()

    private val authInterceptor: (ProtocolClientConfig) -> Interceptor = {
        object : Interceptor {
            override fun unaryFunction(): UnaryFunction {
                return UnaryFunction(
                    requestFunction = { req ->
                        val token = tokenProvider()
                        if (token.isNullOrBlank()) {
                            req
                        } else {
                            val headers: Headers = req.headers + mapOf("authorization" to listOf("Bearer $token"))
                            req.clone(headers = headers)
                        }
                    },
                    responseFunction = { it }
                )
            }

            override fun streamFunction(): StreamFunction {
                return StreamFunction(
                    requestFunction = { req ->
                        val token = tokenProvider()
                        if (token.isNullOrBlank()) {
                            req
                        } else {
                            val headers: Headers = req.headers + mapOf("authorization" to listOf("Bearer $token"))
                            req.clone(headers = headers)
                        }
                    },
                    requestBodyFunction = { it },
                    streamResultFunction = { it }
                )
            }
        }
    }

    val protocolClient = ProtocolClient(
        httpClient = ConnectOkHttpClient(okHttpClient),
        config = ProtocolClientConfig(
            host = host,
            serializationStrategy = GoogleJavaLiteProtobufStrategy(),
            ioCoroutineContext = Dispatchers.IO,
            interceptors = listOf(authInterceptor)
        )
    )

    val auth = AuthServiceClient(protocolClient)
    val chat = ChatServiceClient(protocolClient)
    val conversation = ConversationServiceClient(protocolClient)
    val provider = ProviderServiceClient(protocolClient)
    val storage = StorageServiceClient(protocolClient)
    val sync = SyncServiceClient(protocolClient)
}
