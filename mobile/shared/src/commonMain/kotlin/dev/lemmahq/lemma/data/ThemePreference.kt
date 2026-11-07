package dev.lemmahq.lemma.data

enum class ThemePreference {
    System,
    Light,
    Dark;

    /** Whether the app shows its dark theme while the system theme is dark if [systemDark]. */
    fun isDark(systemDark: Boolean): Boolean =
        when (this) {
            System -> systemDark
            Light -> false
            Dark -> true
        }
}
