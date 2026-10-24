package dev.lemmahq.lemma.network

import com.connectrpc.ProtocolClientConfig
import com.connectrpc.extensions.GoogleJavaLiteProtobufStrategy
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import dev.lemmahq.gen.lemma.v1.AgentServiceClient
import dev.lemmahq.gen.lemma.v1.AuthServiceClient
import dev.lemmahq.gen.lemma.v1.ConversationServiceClient
import dev.lemmahq.gen.lemma.v1.ProviderServiceClient
import dev.lemmahq.lemma.data.SettingsRepository
import kotlinx.coroutines.Dispatchers
import okhttp3.Interceptor
import okhttp3.OkHttpClient

/**
 * Connect clients of the four Lemma services at [host], authenticated by [AuthInterceptor].
 * Requests go over the network, or to [transport] when it is set, which answers them in place of a
 * server.
 */
class LemmaRpcClient(host: String, settings: SettingsRepository, transport: Interceptor? = null) {
    private val okHttpClient =
        ConnectOkHttpClient.configureClient(
                OkHttpClient.Builder().addInterceptor(AuthInterceptor(settings)).apply {
                    transport?.let { addInterceptor(it) }
                }
            )
            .build()

    private val protocolClient =
        ProtocolClient(
            httpClient = ConnectOkHttpClient(okHttpClient),
            config =
                ProtocolClientConfig(
                    host = host,
                    serializationStrategy = GoogleJavaLiteProtobufStrategy(),
                    ioCoroutineContext = Dispatchers.IO,
                ),
        )

    val auth = AuthServiceClient(protocolClient)
    val agent = AgentServiceClient(protocolClient)
    val conversation = ConversationServiceClient(protocolClient)
    val provider = ProviderServiceClient(protocolClient)
}
