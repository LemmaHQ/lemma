package com.lemmaos.lemma.domain

data class Conversation(
    val id: String,
    val title: String,
    val archived: Boolean,
    val messageCount: Int,
    val createdAtMs: Long,
    val updatedAtMs: Long,
    val archivedAtMs: Long?,
)
