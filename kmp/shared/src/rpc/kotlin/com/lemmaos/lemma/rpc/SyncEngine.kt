package com.lemmaos.lemma.rpc

import com.lemmaos.gen.lemma.v1.pullRequest
import com.lemmaos.gen.lemma.v1.watchRequest
import com.lemmaos.lemma.data.SessionStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

private const val BACKOFF_START_MS = 1000L
private const val BACKOFF_MAX_MS = 30_000L
private const val IDLE_HINT_POLL_MS = 30_000L

data class SyncStatus(
    val online: Boolean = false,
    val syncing: Boolean = false,
)

class SyncEngine(
    private val clients: ApiClients,
    private val cache: CacheStore,
    private val session: SessionStore,
) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJobCompat())

    private val _status = MutableStateFlow(SyncStatus())
    val status: StateFlow<SyncStatus> = _status.asStateFlow()

    private val listeners = mutableListOf<() -> Unit>()

    private var running = false
    private var watchJob: Job? = null
    private val pullMutex = Mutex()
    private var pullInFlight: Job? = null

    fun onSynced(listener: () -> Unit): () -> Unit {
        listeners.add(listener)
        return { listeners.remove(listener) }
    }

    @Synchronized
    fun start() {
        if (running) return
        running = true
        watchJob = scope.launch { watchLoop() }
    }

    @Synchronized
    fun stop() {
        running = false
        watchJob?.cancel()
        watchJob = null
    }

    suspend fun pullAll() {
        pullMutex.withLock {
            _status.value = _status.value.copy(syncing = true)
            try {
                var after = cache.cursor()
                while (true) {
                    val res = clients.sync.pull(pullRequest { this.after = after }, emptyMap())
                        .orThrowApp()
                    cache.applyPull(res)
                    after = res.nextAfter
                    if (!res.hasMore) break
                }
                cache.setCursor(after)
                _status.value = _status.value.copy(online = true)
                for (cb in listeners.toList()) cb()
            } finally {
                _status.value = _status.value.copy(syncing = false)
            }
        }
    }

    private suspend fun watchLoop() {
        var backoff = BACKOFF_START_MS
        while (running) {
            try {
                val stream = clients.sync.watch(emptyMap())
                stream.sendAndClose(watchRequest { })
                _status.value = _status.value.copy(online = true)
                backoff = BACKOFF_START_MS
                // Catch up before consuming hints so nothing that changed
                // while the stream was down is missed.
                pullAll()
                for (response in stream.responseChannel()) {
                    if (!running) break
                    if (response.kindCase != com.lemmaos.gen.lemma.v1.WatchResponse.KindCase.HINT) continue
                    // A hint only says "something changed"; pull to find out.
                    // Hints at or below the cursor are already applied.
                    if (response.hint.syncSeq > cache.cursor()) {
                        pullAll()
                    }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                if (!running) break
                _status.value = _status.value.copy(online = false)
            }
            if (!running) break
            delay(backoff)
            backoff = (backoff * 2).coerceAtMost(BACKOFF_MAX_MS)
        }
    }

    private fun SupervisorJobCompat(): Job = Job()
}
