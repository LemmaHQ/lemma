package com.lemmaos.lemma.domain

data class User(
    val id: String,
    val username: String,
    val email: String,
    val owner: Boolean,
)
