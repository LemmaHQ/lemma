package dev.lemmahq.lemma.client

/** A [Connector] that records each connection it opens and answers with [onOpen]. */
class FakeConnector(client: LemmaClient) : Connector {

    val opened = mutableListOf<Connection>()

    var onOpen: suspend (Connection) -> LemmaClient = { client }

    override val localAvailable = true

    override suspend fun open(connection: Connection): LemmaClient {
        opened += connection
        return onOpen(connection)
    }
}
