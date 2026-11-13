package dev.lemmahq.lemma.client

/** A web search or fetch backend as surfaced to the UI without its API key. */
data class ClientWebProvider(
    val id: String,
    val kind: ClientWebProviderKind,
    val name: String,
    val enabled: Boolean,
    val hasKey: Boolean,
    val searchRank: Int,
    val fetchRank: Int,
)
