package dev.lemmahq.lemma.client

/** An [EngineOpener] that counts open calls and answers with [onOpen]. */
class FakeEngineOpener(client: LemmaClient) : EngineOpener {

    var openCalls = 0
        private set

    var onOpen: suspend () -> LemmaClient = { client }

    override suspend fun open(): LemmaClient {
        openCalls++
        return onOpen()
    }
}
