package com.lemmaos.lemma.domain

data class StorageConfig(
    val configured: Boolean,
    val endpoint: String,
    val region: String,
    val bucket: String,
    val pendingMigration: Boolean,
)
