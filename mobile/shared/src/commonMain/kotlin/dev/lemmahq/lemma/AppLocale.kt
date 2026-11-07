package dev.lemmahq.lemma

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidedValue

/** The provided value that resolves resources in the locale [tag], or the system's when null. */
@Composable internal expect fun appLocale(tag: String?): ProvidedValue<*>
