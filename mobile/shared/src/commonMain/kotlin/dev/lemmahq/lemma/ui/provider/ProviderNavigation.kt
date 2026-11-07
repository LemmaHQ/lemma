package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.toRoute
import dev.lemmahq.lemma.client.LemmaClient

/**
 * Adds the AI provider pages under [ProviderGraph]; [client] returns the client of the open
 * connection, and the pages show nothing without one. A detail page whose provider is gone, such as
 * one just deleted, returns to the list.
 */
internal fun NavGraphBuilder.providerGraph(
    navController: NavController,
    client: () -> LemmaClient?,
) {
    navigation<ProviderGraph>(startDestination = ProviderListRoute) {
        composable<ProviderListRoute> { entry ->
            val lemmaClient = client() ?: return@composable
            ProviderListScreen(
                viewModel = sharedViewModel(navController, entry, lemmaClient),
                onBack = { navController.navigateUp() },
                onOpen = { id -> navController.navigate(ProviderDetailRoute(id)) },
                onNew = { navController.navigate(NewProviderRoute) },
            )
        }
        composable<ProviderDetailRoute> { entry ->
            val lemmaClient = client() ?: return@composable
            val providers = sharedViewModel(navController, entry, lemmaClient)
            val provider = providers.provider(entry.toRoute<ProviderDetailRoute>().id)
            when {
                provider != null ->
                    ProviderDetailScreen(
                        viewModel =
                            viewModel {
                                ProviderDetailViewModel(
                                    lemmaClient,
                                    provider,
                                    providers::store,
                                    providers::remove,
                                )
                            },
                        onBack = { navController.navigateUp() },
                    )
                providers.loading -> ProviderLoadingScreen(onBack = { navController.navigateUp() })
                else -> LaunchedEffect(Unit) { navController.navigateUp() }
            }
        }
        composable<NewProviderRoute> { entry ->
            val lemmaClient = client() ?: return@composable
            val providers = sharedViewModel(navController, entry, lemmaClient)
            NewProviderScreen(
                viewModel = viewModel { NewProviderViewModel(lemmaClient, providers::store) },
                onBack = { navController.navigateUp() },
                onOpenProvider = { id ->
                    navController.navigate(ProviderDetailRoute(id)) {
                        popUpTo<NewProviderRoute> { inclusive = true }
                    }
                },
            )
        }
    }
}

@Composable
private fun sharedViewModel(
    navController: NavController,
    entry: NavBackStackEntry,
    client: LemmaClient,
): ProviderViewModel {
    val graphEntry = remember(entry) { navController.getBackStackEntry<ProviderGraph>() }
    return viewModel(viewModelStoreOwner = graphEntry) { ProviderViewModel(client) }
}
