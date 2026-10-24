package dev.lemmahq.lemma.engine

import android.content.Context
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import dev.lemmahq.lemma.uniffi.EngineException
import dev.lemmahq.lemma.uniffi.Header
import dev.lemmahq.lemma.uniffi.LemmaEngine
import java.io.IOException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Call
import okhttp3.Headers
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.asResponseBody
import okio.Buffer
import okio.Source
import okio.Timeout
import okio.buffer

/** Base URL of the local engine; its requests never reach the network. */
const val ENGINE_BASE_URL = "http://engine.lemma.invalid"

/** Opens the process-lifetime local engine over the app's files directory, once. */
object LocalEngine {
    private val mutex = Mutex()
    private var engine: LemmaEngine? = null

    /** A Connect client of the local engine, opening and migrating its database on first use. */
    suspend fun client(context: Context, settings: SettingsRepository): LemmaRpcClient =
        LemmaRpcClient(ENGINE_BASE_URL, settings, transport(context))

    /** The open engine as an OkHttp transport, opening and migrating its database on first use. */
    private suspend fun transport(context: Context): Interceptor =
        EngineInterceptor(
            mutex.withLock {
                engine ?: LemmaEngine.open(context.filesDir.absolutePath).also { engine = it }
            }
        )
}

/** Answers every request of an OkHttp client from [engine] instead of the network. */
private class EngineInterceptor(private val engine: LemmaEngine) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val body = request.body
        val bytes = Buffer().also { body?.writeTo(it) }.readByteArray()
        val headers = request.headers.map { (name, value) -> Header(name, value) }.toMutableList()
        val contentType = body?.contentType()
        if (contentType != null && request.header("Content-Type") == null) {
            headers += Header("Content-Type", contentType.toString())
        }
        val path = request.url.encodedPath + (request.url.encodedQuery?.let { "?$it" } ?: "")
        val head = engineCall { engine.request(request.method, path, headers, bytes) }
        val responseHeaders =
            Headers.Builder().apply { head.headers.forEach { add(it.name, it.value) } }.build()
        return Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(head.status.toInt())
            .message("")
            .headers(responseHeaders)
            .body(
                EngineSource(engine, head.body, chain.call())
                    .buffer()
                    .asResponseBody(responseHeaders["Content-Type"]?.toMediaTypeOrNull())
            )
            .build()
    }
}

/** A response body read chunk by chunk from the engine; closing it early cancels the body. */
private class EngineSource(
    private val engine: LemmaEngine,
    private val body: UInt,
    private val call: Call,
) : Source {
    private val pending = Buffer()
    private var ended = false

    override fun read(sink: Buffer, byteCount: Long): Long {
        while (pending.size == 0L) {
            if (ended) {
                return -1
            }
            if (call.isCanceled()) {
                throw IOException("Canceled")
            }
            val chunk = engineCall { engine.read(body) }
            if (chunk == null) {
                ended = true
            } else {
                pending.write(chunk)
            }
        }
        return pending.read(sink, byteCount)
    }

    override fun timeout(): Timeout = Timeout.NONE

    override fun close() {
        if (!ended) {
            ended = true
            engine.cancel(body)
        }
        pending.clear()
    }
}

private fun <T> engineCall(block: suspend () -> T): T =
    try {
        runBlocking { block() }
    } catch (e: EngineException) {
        throw IOException(e.message, e)
    }
