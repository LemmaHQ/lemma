package io.github.mistvesper.lemma.engine

import android.content.Context

/** Lets the engine check TLS certificates against Android's system trust store. */
object PlatformVerifier {

    /** Hands the application context to the engine; call it before the engine's first request. */
    fun install(context: Context) {
        System.loadLibrary("lemma_uniffi")
        init(context.applicationContext)
    }

    @JvmStatic private external fun init(context: Context)
}
