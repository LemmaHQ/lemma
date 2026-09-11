package com.lemmaos.lemma

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform