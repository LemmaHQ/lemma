package dev.lemmahq.lemma.client

/** A [Connector] that counts open calls and answers with [onOpen]. */
class FakeConnector(client: LemmaClient) : Connector {

    var openCalls = 0
        private set

    var onOpen: suspend () -> LemmaClient = { client }

    override suspend fun open(): LemmaClient {
        openCalls++
        return onOpen()
    }
}
