package com.lemmaos.lemma.data

import com.lemmaos.lemma.domain.StorageConfig
import kotlinx.coroutines.flow.StateFlow

interface StorageRepository {
    val config: StateFlow<StorageConfig?>
    val migrationProgress: StateFlow<MigrationProgress?>

    suspend fun refresh()

    suspend fun save(patch: StoragePatch): Int

    suspend fun test(patch: StoragePatch): String

    suspend fun delete()

    suspend fun runMigration()
}

data class StoragePatch(
    val endpoint: String = "",
    val region: String = "",
    val bucket: String = "",
    val accessKey: String = "",
    val secretKey: String = "",
)

data class MigrationProgress(
    val done: Int,
    val total: Int,
    val skipped: Int,
    val finished: Boolean = false,
    val error: String? = null,
)
