package dev.lemmahq.lemma

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dev.lemmahq.lemma.client.Connector
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.agent.AgentViewModel
import dev.lemmahq.lemma.ui.agent.SessionStage
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.preferences.AppearanceScreen
import dev.lemmahq.lemma.ui.provider.ProviderGraph
import dev.lemmahq.lemma.ui.provider.providerGraph
import dev.lemmahq.lemma.ui.session.SessionListViewModel
import dev.lemmahq.lemma.ui.session.SessionScreen
import dev.lemmahq.lemma.ui.settings.SettingsScreen
import dev.lemmahq.lemma.ui.webprovider.WebProviderScreen
import dev.lemmahq.lemma.ui.webprovider.WebProviderViewModel
import kotlinx.coroutines.flow.first
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_retry
import org.jetbrains.compose.resources.stringResource

/** The app over one [settings] store and one [connector] for the whole process. */
@Composable
@Suppress("ViewModelInjection")
fun App(
    settings: SettingsRepository,
    connector: Connector,
    modifier: Modifier = Modifier,
) {
    val appViewModel = viewModel { AppViewModel(connector) }
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
                appRoutes(navController, appViewModel, settings)
            }
        }
    }
}

private fun NavGraphBuilder.appRoutes(
    navController: NavController,
    appViewModel: AppViewModel,
    settings: SettingsRepository,
) {
    composable<OpeningRoute> { LoadingIndicator() }
    composable<EngineFailedRoute> {
        val failed = appViewModel.state as? AppState.Failed ?: return@composable
        EngineFailedView(error = failed.error.text(), onRetry = appViewModel::retry)
    }
    composable<SessionRoute> {
        val ready = appViewModel.state as? AppState.Ready ?: return@composable
        val agent = viewModel { AgentViewModel(ready.client, settings, createSavedStateHandle()) }
        val sessions = viewModel { SessionListViewModel(ready.client, agent) }
        SessionScreen(
            sessions = sessions,
            openSessionId = agent.openSession?.id,
            onNewSession = agent::newSession,
            onOpenSettings = { navController.navigate(SettingsRoute) },
        ) { openDrawer ->
            SessionStage(
                viewModel = agent,
                sessionTitle = sessions.currentSession?.title,
                createSession = sessions::createSession,
                onOpenDrawer = openDrawer,
                onManageProviders = { navController.navigate(ProviderGraph) },
            )
        }
    }
    composable<SettingsRoute> {
        SettingsScreen(
            onAppearance = { navController.navigate(AppearanceRoute) },
            onProviders = { navController.navigate(ProviderGraph) },
            onWebProviders = { navController.navigate(WebProviderRoute) },
            onBack = { navController.navigateUp() },
        )
    }
    composable<WebProviderRoute> {
        val ready = appViewModel.state as? AppState.Ready ?: return@composable
        WebProviderScreen(
            viewModel = viewModel { WebProviderViewModel(ready.client) },
            onBack = { navController.navigateUp() },
        )
    }
    composable<AppearanceRoute> {
        AppearanceScreen(settings = settings, onBack = { navController.navigateUp() })
    }
    providerGraph(navController) { (appViewModel.state as AppState.Ready).client }
}

private fun AppState.route(): Any =
    when (this) {
        AppState.Opening -> OpeningRoute
        is AppState.Failed -> EngineFailedRoute
        is AppState.Ready -> SessionRoute
    }

@Composable
private fun LoadingIndicator() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = LemmaTheme.colors.brand)
    }
}

@Composable
private fun EngineFailedView(error: String, onRetry: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = error,
                style = LemmaTheme.typography.body,
                color = LemmaTheme.colors.destructive,
                textAlign = TextAlign.Center,
            )
            LemmaButton(text = stringResource(Res.string.common_retry), onClick = onRetry)
        }
    }
}
