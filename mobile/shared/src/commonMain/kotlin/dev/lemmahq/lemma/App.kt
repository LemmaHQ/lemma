package dev.lemmahq.lemma

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dev.lemmahq.lemma.client.Connector
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.auth.AuthScreen
import dev.lemmahq.lemma.ui.auth.AuthViewModel
import dev.lemmahq.lemma.ui.provider.ProviderGraph
import dev.lemmahq.lemma.ui.provider.providerGraph
import dev.lemmahq.lemma.ui.session.SessionScreen
import dev.lemmahq.lemma.ui.session.SessionViewModel
import dev.lemmahq.lemma.ui.settings.AppearanceScreen
import dev.lemmahq.lemma.ui.settings.SettingsScreen
import dev.lemmahq.lemma.ui.setup.SetupScreen
import kotlinx.coroutines.flow.first

/**
 * The app over one [settings] store and one [connector] for the whole process; [messageCache] holds
 * the messages sessions have shown, and [appVersion] is the release of this app.
 */
@Composable
fun App(
    settings: SettingsRepository,
    messageCache: LocalMessageRepository,
    connector: Connector,
    appVersion: String,
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel = viewModel { AppViewModel(settings, connector, messageCache) },
) {
    val gate = appViewModel.state.route()
    val navController = rememberNavController()
    val startRoute = remember { gate }

    LaunchedEffect(gate) {
        val current = navController.currentBackStackEntryFlow.first()
        if (!current.destination.hasRoute(gate::class)) {
            navController.navigate(gate) { popUpTo(navController.graph.id) { inclusive = true } }
        }
    }

    val theme by settings.theme.collectAsState()
    val language by settings.language.collectAsState()
    val dark = theme.isDark(isSystemInDarkTheme())

    CompositionLocalProvider(appLocale(language.tag)) {
        LemmaTheme(darkTheme = dark) {
            NavHost(
                navController = navController,
                startDestination = startRoute,
                modifier =
                    modifier
                        .fillMaxSize()
                        .background(LemmaTheme.colors.background)
                        .safeDrawingPadding(),
            ) {
                appRoutes(navController, appViewModel, settings, messageCache, appVersion)
            }
        }
    }
}

private fun NavGraphBuilder.appRoutes(
    navController: NavController,
    appViewModel: AppViewModel,
    settings: SettingsRepository,
    messageCache: LocalMessageRepository,
    appVersion: String,
) {
    composable<OpeningRoute> { LoadingIndicator() }
    composable<SetupRoute> { SetupScreen(appViewModel) }
    composable<AuthRoute> {
        val connected = appViewModel.state as? AppState.Connected ?: return@composable
        AuthScreen(
            viewModel = viewModel { AuthViewModel(connected.client) },
            connection = connected.connection,
            appVersion = appVersion,
            onChangeConnection = appViewModel::changeConnection,
        )
    }
    composable<SessionRoute> {
        val connected = appViewModel.state as? AppState.Connected ?: return@composable
        SessionScreen(
            viewModel =
                viewModel {
                    SessionViewModel(
                        connected.client,
                        settings,
                        messageCache,
                        createSavedStateHandle(),
                    )
                },
            username = appViewModel.user?.username,
            onManageProviders = { navController.navigate(ProviderGraph) },
            onOpenSettings = { navController.navigate(SettingsRoute) },
            onLoadAccount = appViewModel::loadUser,
            onSignOut = appViewModel::signOut,
        )
    }
    composable<SettingsRoute> {
        SettingsScreen(
            onAppearance = { navController.navigate(AppearanceRoute) },
            onProviders = { navController.navigate(ProviderGraph) },
            onBack = { navController.navigateUp() },
        )
    }
    composable<AppearanceRoute> {
        AppearanceScreen(settings = settings, onBack = { navController.navigateUp() })
    }
    providerGraph(navController) { (appViewModel.state as? AppState.Connected)?.client }
}

private fun AppState.route(): Any =
    when (this) {
        AppState.Opening -> OpeningRoute
        AppState.Setup -> SetupRoute
        is AppState.Connected -> if (signedIn) SessionRoute else AuthRoute
    }

@Composable
private fun LoadingIndicator() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = LemmaTheme.colors.primary)
    }
}
