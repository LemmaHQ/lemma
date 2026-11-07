package dev.lemmahq.lemma.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

private const val PREFERENCES_NAME = "lemma_tokens"
private const val KEY_TOKENS = "tokens"
private const val KEY_ALIAS = "lemma_token_store"
private const val KEY_SIZE = 256
private const val GCM_IV_SIZE = 12
private const val GCM_TAG_SIZE = 128
private const val TRANSFORMATION = "AES/GCM/NoPadding"

/**
 * Stores the token pair as AES-GCM ciphertext protected by an Android Keystore key, which [key]
 * returns the first time the store encrypts or decrypts.
 */
class KeystoreTokenStore(context: Context, key: () -> SecretKey = ::androidTokenKey) : TokenStore {
    private val secretKey by lazy(key)
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun load(): TokenPair? {
        val encoded = preferences.getString(KEY_TOKENS, null) ?: return null
        return try {
            val payload = Base64.decode(encoded, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey,
                GCMParameterSpec(GCM_TAG_SIZE, payload.copyOfRange(0, GCM_IV_SIZE)),
            )
            val json =
                JSONObject(
                    cipher
                        .doFinal(payload.copyOfRange(GCM_IV_SIZE, payload.size))
                        .toString(Charsets.UTF_8)
                )
            TokenPair(json.getString("accessToken"), json.getString("refreshToken"))
        } catch (_: Exception) {
            clear()
            null
        }
    }

    override fun save(tokens: TokenPair) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        val json =
            JSONObject()
                .put("accessToken", tokens.accessToken)
                .put("refreshToken", tokens.refreshToken)
                .toString()
        val payload = cipher.iv + cipher.doFinal(json.toByteArray(Charsets.UTF_8))
        preferences.edit {
            putString(KEY_TOKENS, Base64.encodeToString(payload, Base64.NO_WRAP))
        }
    }

    override fun clear() {
        preferences.edit { remove(KEY_TOKENS) }
    }
}

private fun androidTokenKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let {
        return it
    }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
        KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
            .setKeySize(KEY_SIZE)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build()
    )
    return generator.generateKey()
}
