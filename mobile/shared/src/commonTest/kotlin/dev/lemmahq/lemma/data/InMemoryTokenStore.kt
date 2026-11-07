package dev.lemmahq.lemma.data

class InMemoryTokenStore : TokenStore {
    private var tokens: TokenPair? = null

    override fun load(): TokenPair? = tokens

    override fun save(tokens: TokenPair) {
        this.tokens = tokens
    }

    override fun clear() {
        tokens = null
    }
}
