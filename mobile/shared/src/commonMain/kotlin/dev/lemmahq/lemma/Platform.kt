package dev.lemmahq.lemma

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform