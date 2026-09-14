package com.lemmaos.lemma.domain

data class Provider(
    val id: String,
    val kind: String,
    val name: String,
    val baseUrl: String,
    val apiKeyMasked: String,
    val models: List<String>,
    val enabled: Boolean,
    val apiPath: String,
    val modelsPath: String,
)
