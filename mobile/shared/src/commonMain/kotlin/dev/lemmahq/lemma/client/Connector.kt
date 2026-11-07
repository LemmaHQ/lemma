package dev.lemmahq.lemma.client

/** Opens a [LemmaClient] for a [Connection]. */
interface Connector {

    /** Whether this platform runs the engine in-process, so [Connection.Local] can open. */
    val localAvailable: Boolean

    /**
     * Opens a client of the server or the in-process engine; opening the engine migrates its
     * database on first use and throws [ServiceException] when the engine cannot start.
     */
    suspend fun open(connection: Connection): LemmaClient
}
