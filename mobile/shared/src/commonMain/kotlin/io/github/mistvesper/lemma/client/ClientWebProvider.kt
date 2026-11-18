package io.github.mistvesper.lemma.client

/** A web search or fetch backend as surfaced to the UI. */
data class ClientWebProvider(
    val id: String,
    val kind: ClientWebProviderKind,
    val name: String,
    val enabled: Boolean,
    val apiKey: String,
    val searchRank: Int,
    val fetchRank: Int,
)
