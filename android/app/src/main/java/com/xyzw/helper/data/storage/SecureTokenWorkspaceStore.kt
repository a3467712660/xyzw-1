package com.xyzw.helper.data.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.network.NetworkFactory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer

class SecureTokenWorkspaceStore(
  context: Context,
  private val preferences: SharedPreferences = createPreferences(context),
) {
  private val mutableTokens = MutableStateFlow(loadTokens())
  val tokens: StateFlow<List<ImportedGameToken>> = mutableTokens.asStateFlow()

  fun replaceAll(nextTokens: List<ImportedGameToken>) {
    mutableTokens.value = nextTokens
    persist(nextTokens)
  }

  fun upsert(token: ImportedGameToken) {
    val current = mutableTokens.value.toMutableList()
    val index = current.indexOfFirst { it.id == token.id }
    if (index >= 0) {
      current[index] = token
    } else {
      current += token
    }
    replaceAll(current)
  }

  fun update(tokenId: String, transform: (ImportedGameToken) -> ImportedGameToken) {
    val current = mutableTokens.value.toMutableList()
    val index = current.indexOfFirst { it.id == tokenId }
    if (index < 0) {
      return
    }
    current[index] = transform(current[index])
    replaceAll(current)
  }

  fun remove(tokenId: String) {
    replaceAll(mutableTokens.value.filterNot { it.id == tokenId })
  }

  fun clear() {
    preferences.edit().remove(KEY_TOKENS).apply()
    mutableTokens.value = emptyList()
  }

  private fun loadTokens(): List<ImportedGameToken> {
    val raw = preferences.getString(KEY_TOKENS, "").orEmpty()
    if (raw.isBlank()) {
      return emptyList()
    }
    return runCatching {
      NetworkFactory.json.decodeFromString(
        ListSerializer(ImportedGameToken.serializer()),
        raw,
      )
    }.getOrDefault(emptyList())
  }

  private fun persist(tokens: List<ImportedGameToken>) {
    preferences.edit()
      .putString(
        KEY_TOKENS,
        NetworkFactory.json.encodeToString(
          ListSerializer(ImportedGameToken.serializer()),
          tokens,
        ),
      )
      .apply()
  }

  private companion object {
    const val FILE_NAME = "xyzw_token_workspace_store"
    const val KEY_TOKENS = "tokens"

    fun createPreferences(context: Context): SharedPreferences {
      val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
      return EncryptedSharedPreferences.create(
        context,
        FILE_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
      )
    }
  }
}
