package com.lemmaos.lemma.rpc

import com.connectrpc.Interceptor
import com.connectrpc.ProtocolClientConfig
import com.connectrpc.StreamFunction
import com.connectrpc.UnaryFunction
import com.connectrpc.extensions.GoogleJavaLiteProtobufStrategy
import com.connectrpc.http.clone
import com.connectrpc.impl.ProtocolClient
import com.connectrpc.okhttp.ConnectOkHttpClient
import com.connectrpc.simpleTimeouts
import com.lemmaos.gen.lemma.v1.AuthServiceClient
import com.lemmaos.gen.lemma.v1.ChatServiceClient
import com.lemmaos.gen.lemma.v1.ConversationServiceClient
import com.lemmaos.gen.lemma.v1.ProviderServiceClient
import com.lemmaos.gen.lemma.v1.StorageServiceClient
import com.lemmaos.gen.lemma.v1.SyncServiceClient
import com.lemmaos.lemma.data.SessionStore
import kotlinx.coroutines.Dispatchers
import okhttp3.OkHttpClient
import kotlin.time.DurationUnit
import kotlin.time.toDuration

class ApiClients(serverUrl: String, session: SessionStore) {

    private val protocolClient = ProtocolClient(
        httpClient = ConnectOkHttpClient(
            ConnectOkHttpClient.configureClient(OkHttpClient.Builder()).build(),
        ),
        config = ProtocolClientConfig(
            host = serverUrl,
            serializationStrategy = GoogleJavaLiteProtobufStrategy(),
            ioCoroutineContext = Dispatchers.IO,
            interceptors = listOf { AuthHeaderInterceptor(session) },
            timeoutOracle = simpleTimeouts(10.toDuration(DurationUnit.SECONDS), null),
        ),
    )

    val auth = AuthServiceClient(protocolClient)
    val conversations = ConversationServiceClient(protocolClient)
    val providers = ProviderServiceClient(protocolClient)
    val sync = SyncServiceClient(protocolClient)
    val storage = StorageServiceClient(protocolClient)
    val chat = ChatServiceClient(protocolClient)
}

private class AuthHeaderInterceptor(private val session: SessionStore) : Interceptor {
    override fun unaryFunction() = UnaryFunction(
        requestFunction = { request ->
            val token = session.accessToken ?: return@UnaryFunction request
            request.clone(headers = request.headers + ("authorization" to listOf("Bearer $token")))
        },
    )

    override fun streamFunction() = StreamFunction(
        requestFunction = { request ->
            val token = session.accessToken ?: return@StreamFunction request
            request.clone(headers = request.headers + ("authorization" to listOf("Bearer $token")))
        },
    )
}
