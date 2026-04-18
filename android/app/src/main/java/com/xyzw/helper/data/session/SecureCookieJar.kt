package com.xyzw.helper.data.session

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.xyzw.helper.data.network.NetworkFactory
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

interface CookieStore {
  fun loadAll(): List<StoredCookie>
  fun saveAll(cookies: List<StoredCookie>)
  fun clear()
}

class InMemoryCookieStore : CookieStore {
  private var cookies: List<StoredCookie> = emptyList()

  override fun loadAll(): List<StoredCookie> = cookies

  override fun saveAll(cookies: List<StoredCookie>) {
    this.cookies = cookies
  }

  override fun clear() {
    cookies = emptyList()
  }
}

class EncryptedCookieStore(
  context: Context,
  private val preferences: SharedPreferences = createPreferences(context),
) : CookieStore {
  override fun loadAll(): List<StoredCookie> {
    val raw = preferences.getString(KEY_COOKIES, "").orEmpty()
    if (raw.isBlank()) {
      return emptyList()
    }
    return runCatching {
      NetworkFactory.json.decodeFromString(ListSerializer(StoredCookie.serializer()), raw)
    }.getOrDefault(emptyList())
  }

  override fun saveAll(cookies: List<StoredCookie>) {
    preferences.edit()
      .putString(
        KEY_COOKIES,
        NetworkFactory.json.encodeToString(ListSerializer(StoredCookie.serializer()), cookies),
      )
      .apply()
  }

  override fun clear() {
    preferences.edit().remove(KEY_COOKIES).apply()
  }

  private companion object {
    const val FILE_NAME = "xyzw_secure_cookie_store"
    const val KEY_COOKIES = "cookies"

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

@Serializable
data class StoredCookie(
  val name: String,
  val value: String,
  val expiresAt: Long,
  val domain: String,
  val path: String,
  val secure: Boolean,
  val httpOnly: Boolean,
  val persistent: Boolean,
  val hostOnly: Boolean,
) {
  fun toCookie(): Cookie {
    val builder = Cookie.Builder()
      .name(name)
      .value(value)
      .path(path)

    if (hostOnly) {
      builder.hostOnlyDomain(domain)
    } else {
      builder.domain(domain)
    }

    if (persistent) {
      builder.expiresAt(expiresAt)
    }
    if (secure) {
      builder.secure()
    }
    if (httpOnly) {
      builder.httpOnly()
    }
    return builder.build()
  }

  companion object {
    fun from(cookie: Cookie) = StoredCookie(
      name = cookie.name,
      value = cookie.value,
      expiresAt = cookie.expiresAt,
      domain = cookie.domain,
      path = cookie.path,
      secure = cookie.secure,
      httpOnly = cookie.httpOnly,
      persistent = cookie.persistent,
      hostOnly = cookie.hostOnly,
    )
  }
}

class SecureCookieJar(
  private val cookieStore: CookieStore,
  private val nowProvider: () -> Long = { System.currentTimeMillis() },
) : CookieJar {
  private val lock = Any()
  private val cookies = cookieStore.loadAll().map { it.toCookie() }.toMutableList()

  override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
    synchronized(lock) {
      pruneExpiredLocked()
      cookies.forEach { incoming ->
        this.cookies.removeAll { stored ->
          stored.name == incoming.name &&
            stored.domain == incoming.domain &&
            stored.path == incoming.path
        }
        this.cookies += incoming
      }
      persistLocked()
    }
  }

  override fun loadForRequest(url: HttpUrl): List<Cookie> = synchronized(lock) {
    pruneExpiredLocked()
    cookies.filter { it.matches(url) }
  }

  fun clear() {
    synchronized(lock) {
      cookies.clear()
      cookieStore.clear()
    }
  }

  fun seed(url: HttpUrl, cookies: List<Cookie>) {
    saveFromResponse(url, cookies)
  }

  private fun pruneExpiredLocked() {
    val now = nowProvider()
    if (cookies.removeAll { it.expiresAt < now }) {
      persistLocked()
    }
  }

  private fun persistLocked() {
    cookieStore.saveAll(cookies.map(StoredCookie::from))
  }
}
