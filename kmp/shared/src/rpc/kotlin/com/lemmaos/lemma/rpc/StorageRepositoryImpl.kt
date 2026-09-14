package com.lemmaos.lemma.rpc

import com.lemmaos.gen.lemma.v1.deleteStorageConfigRequest
import com.lemmaos.gen.lemma.v1.getStorageConfigRequest
import com.lemmaos.gen.lemma.v1.migrateArchivesRequest
import com.lemmaos.gen.lemma.v1.testStorageConfigRequest
import com.lemmaos.gen.lemma.v1.updateStorageConfigRequest
import com.lemmaos.lemma.data.MigrationProgress
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.data.StoragePatch
import com.lemmaos.lemma.data.StorageRepository
import com.lemmaos.lemma.domain.StorageConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class StorageRepositoryImpl(
    private val clients: ApiClients,
    private val session: SessionStore,
) : StorageRepository {

    private val _config = MutableStateFlow<StorageConfig?>(null)
    override val config: StateFlow<StorageConfig?> = _config.asStateFlow()

    private val _migrationProgress = MutableStateFlow<MigrationProgress?>(null)
    override val migrationProgress: StateFlow<MigrationProgress?> = _migrationProgress.asStateFlow()

    override suspend fun refresh() {
        val response = clients.storage
            .getStorageConfig(getStorageConfigRequest {}, emptyMap())
            .orThrowApp()
        _config.value = if (response.hasConfig()) response.config.toDomain() else null
    }

    override suspend fun save(patch: StoragePatch): Int {
        val response = clients.storage
            .updateStorageConfig(
                updateStorageConfigRequest {
                    // Empty strings mean "keep the current value"; the proto
                    // fields are optional and the server treats blank as unset.
                    patch.endpoint.takeIf { it.isNotBlank() }?.let { endpoint = it }
                    patch.region.takeIf { it.isNotBlank() }?.let { region = it }
                    patch.bucket.takeIf { it.isNotBlank() }?.let { bucket = it }
                    patch.accessKey.takeIf { it.isNotEmpty() }?.let { accessKey = it }
                    patch.secretKey.takeIf { it.isNotEmpty() }?.let { secretKey = it }
                },
                emptyMap(),
            )
            .orThrowApp()
        refresh()
        return response.migrationTotal
    }

    override suspend fun test(patch: StoragePatch): String {
        return clients.storage
            .testStorageConfig(
                testStorageConfigRequest {
                    endpoint = patch.endpoint
                    region = patch.region
                    bucket = patch.bucket
                    accessKey = patch.accessKey
                    secretKey = patch.secretKey
                },
                emptyMap(),
            )
            .orThrowApp()
            .message
    }

    override suspend fun delete() {
        clients.storage.deleteStorageConfig(deleteStorageConfigRequest {}, emptyMap()).orThrowApp()
        _config.value = null
    }

    override suspend fun runMigration() {
        val stream = clients.storage.migrateArchives(emptyMap())
        stream.sendAndClose(migrateArchivesRequest { })
        try {
            for (frame in stream.responseChannel()) {
                _migrationProgress.value = MigrationProgress(
                    done = frame.done,
                    total = frame.total,
                    skipped = frame.skipped,
                    finished = frame.finished,
                    error = frame.error.ifEmpty { null },
                )
            }
        } catch (e: CancellationException) {
            throw e
        } finally {
            refresh()
        }
    }

    private fun com.lemmaos.gen.lemma.v1.StorageConfig.toDomain() = StorageConfig(
        configured = true,
        endpoint = endpoint,
        region = region,
        bucket = bucket,
        pendingMigration = pendingMigration,
    )
}
