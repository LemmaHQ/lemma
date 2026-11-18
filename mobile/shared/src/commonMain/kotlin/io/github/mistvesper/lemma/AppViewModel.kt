package io.github.mistvesper.lemma

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.mistvesper.lemma.client.EngineOpener
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.i18n.UiText
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_engine_failed

/** Opens the in-process engine once; [state] decides which part of the app shows. */
class AppViewModel(private val engineOpener: EngineOpener) : ViewModel() {

    var state by mutableStateOf<AppState>(AppState.Opening)
        private set

    init {
        open()
    }

    /** Reopens the engine after [AppState.Failed]; does nothing in other states. */
    fun retry() {
        if (state !is AppState.Failed) return
        open()
    }

    private fun open() {
        state = AppState.Opening
        viewModelScope.launch {
            state =
                try {
                    AppState.Ready(engineOpener.open())
                } catch (_: ServiceException) {
                    AppState.Failed(UiText.Resource(Res.string.errors_engine_failed))
                }
        }
    }
}
