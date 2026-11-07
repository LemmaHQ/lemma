package dev.lemmahq.lemma.data

interface TokenStore {
    fun load(): TokenPair?

    fun save(tokens: TokenPair)

    fun clear()
}
