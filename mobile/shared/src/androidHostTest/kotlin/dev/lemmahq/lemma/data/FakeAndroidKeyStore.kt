package dev.lemmahq.lemma.data

import android.security.keystore.KeyGenParameterSpec
import java.io.InputStream
import java.io.OutputStream
import java.security.Key
import java.security.KeyStoreSpi
import java.security.Provider
import java.security.SecureRandom
import java.security.cert.Certificate
import java.security.spec.AlgorithmParameterSpec
import java.util.Collections
import java.util.Date
import java.util.Enumeration
import javax.crypto.KeyGenerator
import javax.crypto.KeyGeneratorSpi
import javax.crypto.SecretKey

internal const val FAKE_ANDROID_KEY_STORE = "AndroidKeyStore"

private val keys = mutableMapOf<String, SecretKey>()

/**
 * The `AndroidKeyStore` provider Robolectric lacks: its key store holds the AES keys its key
 * generator creates, by alias, for the life of the test process.
 */
internal class FakeAndroidKeyStore : Provider(FAKE_ANDROID_KEY_STORE, 1.0, "Fake AndroidKeyStore") {
    init {
        put("KeyStore.$FAKE_ANDROID_KEY_STORE", Store::class.java.name)
        put("KeyGenerator.AES", Generator::class.java.name)
    }

    class Generator : KeyGeneratorSpi() {
        private lateinit var alias: String

        override fun engineInit(params: AlgorithmParameterSpec, random: SecureRandom?) {
            alias = (params as KeyGenParameterSpec).keystoreAlias
        }

        override fun engineInit(random: SecureRandom?) = unsupported()

        override fun engineInit(keysize: Int, random: SecureRandom?) = unsupported()

        override fun engineGenerateKey(): SecretKey =
            KeyGenerator.getInstance("AES").generateKey().also { keys[alias] = it }
    }

    class Store : KeyStoreSpi() {
        override fun engineLoad(stream: InputStream?, password: CharArray?) = Unit

        override fun engineGetKey(alias: String, password: CharArray?): Key? = keys[alias]

        override fun engineContainsAlias(alias: String): Boolean = alias in keys

        override fun engineAliases(): Enumeration<String> = Collections.enumeration(keys.keys)

        override fun engineSize(): Int = keys.size

        override fun engineIsKeyEntry(alias: String): Boolean = alias in keys

        override fun engineGetCertificateChain(alias: String): Array<Certificate>? = null

        override fun engineGetCertificate(alias: String): Certificate? = null

        override fun engineGetCreationDate(alias: String): Date? = null

        override fun engineSetKeyEntry(
            alias: String,
            key: Key,
            password: CharArray?,
            chain: Array<out Certificate>?,
        ) = unsupported()

        override fun engineSetKeyEntry(
            alias: String,
            key: ByteArray,
            chain: Array<out Certificate>?,
        ) = unsupported()

        override fun engineSetCertificateEntry(alias: String, cert: Certificate) = unsupported()

        override fun engineDeleteEntry(alias: String) = unsupported()

        override fun engineIsCertificateEntry(alias: String): Boolean = false

        override fun engineGetCertificateAlias(cert: Certificate): String? = null

        override fun engineStore(stream: OutputStream, password: CharArray?) = unsupported()
    }
}

private fun unsupported(): Nothing = throw UnsupportedOperationException()
