package dev.lemmahq.lemma.client

/** Patch input for a web provider's API key and enabled flag. */
data class ClientWebProviderPatch(val apiKey: String? = null, val enabled: Boolean? = null)
