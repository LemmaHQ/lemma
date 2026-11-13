package dev.lemmahq.lemma.network

import com.connectrpc.ProtocolClientConfig
import com.connectrpc.extensions.GoogleJavaLiteProtobufStrategy
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import dev.lemmahq.gen.lemma.v1.AgentServiceClient
import dev.lemmahq.gen.lemma.v1.ProviderServiceClient
import dev.lemmahq.gen.lemma.v1.SessionServiceClient
import kotlinx.coroutines.Dispatchers
import okhttp3.Interceptor
import okhttp3.OkHttpClient

/**
 * Connect clients of the Lemma services at [host]; [transport] answers every request in place of a
 * server.
 */
@Suppress("InjectDispatcher")
class LemmaRpcClient(host: String, transport: Interceptor) {
    private val okHttpClient =
        ConnectOkHttpClient.configureClient(OkHttpClient.Builder().addInterceptor(transport))
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

    val agent = AgentServiceClient(protocolClient)
    val session = SessionServiceClient(protocolClient)
    val provider = ProviderServiceClient(protocolClient)
}
