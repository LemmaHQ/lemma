package io.github.mistvesper.lemma.ui.provider

import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.toRoute
import io.github.mistvesper.lemma.client.ClientPredefinedProvider
import io.github.mistvesper.lemma.client.LemmaClient

/**
 * Adds the AI provider pages under [ProviderGraph] over [client]. A detail page whose provider is
 * gone, such as one just deleted, returns to the list.
 */
internal fun NavGraphBuilder.providerGraph(
    navController: NavController,
    client: () -> LemmaClient,
) {
    navigation<ProviderGraph>(startDestination = ProviderListRoute) {
        composable<ProviderListRoute> { entry ->
            val lemmaClient = client()
            ProviderListScreen(
                viewModel = sharedViewModel(navController, entry, lemmaClient),
                onBack = { navController.navigateUp() },
                onOpen = { id -> navController.navigate(ProviderDetailRoute(id)) },
                onNew = { navController.navigate(NewProviderRoute) },
            )
        }
        composable<ProviderDetailRoute> { entry ->
            val lemmaClient = client()
            ProviderDetailDestination(
                id = entry.toRoute<ProviderDetailRoute>().id,
                providers = sharedViewModel(navController, entry, lemmaClient),
                client = lemmaClient,
                onBack = { navController.navigateUp() },
            )
        }
        composable<NewProviderRoute> { entry ->
            val lemmaClient = client()
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
private fun ProviderDetailDestination(
    id: String,
    providers: ProviderViewModel,
    client: LemmaClient,
    onBack: () -> Unit,
) {
    val provider = providers.provider(id)
    when {
        provider?.source is ClientPredefinedProvider ->
            PredefinedProviderDetailScreen(
                viewModel =
                    viewModel {
                        PredefinedProviderDetailViewModel(client, provider, providers::store)
                    },
                onBack = onBack,
            )
        provider != null ->
            ProviderDetailScreen(
                viewModel =
                    viewModel {
                        ProviderDetailViewModel(
                            client,
                            provider,
                            providers::store,
                            providers::remove,
                        )
                    },
                onBack = onBack,
            )
        providers.loading -> ProviderLoadingScreen(onBack = onBack)
        else -> {
            val currentOnBack by rememberUpdatedState(onBack)
            SideEffect(Unit) { currentOnBack() }
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
