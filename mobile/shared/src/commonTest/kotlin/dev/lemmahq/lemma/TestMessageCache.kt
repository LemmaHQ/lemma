package dev.lemmahq.lemma

import dev.lemmahq.lemma.data.LocalMessageRepository
import kotlinx.coroutines.CoroutineDispatcher

internal expect fun testMessageCache(dispatcher: CoroutineDispatcher): LocalMessageRepository
