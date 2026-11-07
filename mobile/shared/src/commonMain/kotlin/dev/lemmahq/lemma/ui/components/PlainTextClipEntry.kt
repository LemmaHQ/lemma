package dev.lemmahq.lemma.ui.components

import androidx.compose.ui.platform.ClipEntry

/** A clipboard entry that holds [text] as plain text. */
internal expect fun plainTextClipEntry(text: String): ClipEntry
