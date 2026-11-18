package io.github.mistvesper.lemma.client

/** Opens a [LemmaClient] against the in-process engine. */
interface EngineOpener {

    /**
     * Opens the in-process engine, migrating its database on first use; throws [ServiceException]
     * when the engine cannot start.
     */
    suspend fun open(): LemmaClient
}
