package dev.lemmahq.lemma.ui.provider

import kotlinx.serialization.Serializable

/** The AI provider pages, which share one [ProviderViewModel]. */
@Serializable internal data object ProviderGraph

@Serializable internal data object ProviderListRoute

@Serializable internal data class ProviderDetailRoute(val id: String)

@Serializable internal data object NewProviderRoute
