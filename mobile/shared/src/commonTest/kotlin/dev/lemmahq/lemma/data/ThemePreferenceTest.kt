package dev.lemmahq.lemma.data

import kotlin.test.Test
import kotlin.test.assertEquals

class ThemePreferenceTest {

    @Test
    fun onlyTheSystemPreferenceFollowsTheSystemTheme() {
        assertEquals(
            listOf(false, true, false, false, true, true),
            listOf(ThemePreference.System, ThemePreference.Light, ThemePreference.Dark).flatMap {
                listOf(it.isDark(systemDark = false), it.isDark(systemDark = true))
            },
        )
    }
}
