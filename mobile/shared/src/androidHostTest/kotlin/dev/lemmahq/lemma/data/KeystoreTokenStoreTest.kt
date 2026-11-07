package dev.lemmahq.lemma.data

import android.content.Context
import java.security.Security
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class KeystoreTokenStoreTest {
    private val context = RuntimeEnvironment.getApplication()

    @BeforeTest
    fun setUp() {
        Security.addProvider(FakeAndroidKeyStore())
    }

    @AfterTest
    fun tearDown() {
        Security.removeProvider(FAKE_ANDROID_KEY_STORE)
    }

    @Test
    fun roundTripsTheTokenPair() {
        val store = KeystoreTokenStore(context) { key(1) }
        assertNull(store.load())

        store.save(TokenPair("access-1", "refresh-1"))

        assertEquals(TokenPair("access-1", "refresh-1"), store.load())
    }

    @Test
    fun tokensPersistAcrossStoresUnderTheKeystoreKey() {
        KeystoreTokenStore(context).save(TokenPair("access-2", "refresh-2"))

        val restored = KeystoreTokenStore(context).load()

        assertEquals(TokenPair("access-2", "refresh-2"), restored)
    }

    @Test
    fun clearDeletesTheStoredTokens() {
        val store = KeystoreTokenStore(context) { key(3) }
        store.save(TokenPair("access-3", "refresh-3"))

        store.clear()

        assertNull(store.load())
        assertTrue(tokenPreferences(context).all.isEmpty())
    }

    @Test
    fun undecryptableTokensAreDeleted() {
        KeystoreTokenStore(context) { key(4) }.save(TokenPair("access-4", "refresh-4"))

        val restored = KeystoreTokenStore(context) { key(5) }.load()

        assertNull(restored)
        assertTrue(tokenPreferences(context).all.isEmpty())
    }
}

private fun key(seed: Byte): SecretKey = SecretKeySpec(ByteArray(32) { seed }, "AES")

private fun tokenPreferences(context: Context) =
    context.getSharedPreferences("lemma_tokens", Context.MODE_PRIVATE)
