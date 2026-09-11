package com.lemmaos.lemma

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.lemmaos.lemma.data.ServerConfigStore
import com.lemmaos.lemma.navigation.Home
import com.lemmaos.lemma.navigation.Login
import com.lemmaos.lemma.navigation.ServerUrl
import com.lemmaos.lemma.ui.LemmaTheme
import com.lemmaos.lemma.ui.screens.HomeScreen
import com.lemmaos.lemma.ui.screens.LoginScreen
import com.lemmaos.lemma.ui.screens.ServerUrlScreen

@Composable
fun App() {
    LemmaTheme {
        val store = remember { ServerConfigStore() }
        val startDestination: Any = if (store.serverUrl != null) Login else ServerUrl
        val navController = rememberNavController()
        NavHost(navController = navController, startDestination = startDestination) {
            composable<ServerUrl> {
                ServerUrlScreen(
                    store = store,
                    onContinue = {
                        navController.navigate(Login) {
                            popUpTo<ServerUrl> { inclusive = true }
                        }
                    },
                )
            }
            composable<Login> {
                LoginScreen(
                    onLogin = {
                        navController.navigate(Home) {
                            popUpTo<Login> { inclusive = true }
                        }
                    },
                )
            }
            composable<Home> {
                HomeScreen()
            }
        }
    }
}
