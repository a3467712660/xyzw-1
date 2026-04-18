package com.xyzw.helper.data.storage

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.dataStore by preferencesDataStore(name = "xyzw_helper_preferences")

enum class ThemeMode {
  SYSTEM,
  LIGHT,
  DARK,
}

data class AppPreferences(
  val apiBaseUrl: String,
  val themeMode: ThemeMode,
)

class AppPreferencesStore(
  private val context: Context,
) {
  val preferences: Flow<AppPreferences> = context.dataStore.data
    .catch { exception ->
      if (exception is IOException) {
        emit(emptyPreferences())
      } else {
        throw exception
      }
    }
    .map(::mapPreferences)

  suspend fun ensureDefaults(defaultApiBaseUrl: String): AppPreferences {
    val current = preferences.first()
    if (current.apiBaseUrl.isBlank() || current.themeMode == ThemeMode.SYSTEM) {
      context.dataStore.edit { prefs ->
        if (prefs[KEY_API_BASE_URL].isNullOrBlank()) {
          prefs[KEY_API_BASE_URL] = normalizeBaseUrl(defaultApiBaseUrl)
        }
        if (prefs[KEY_THEME_MODE].isNullOrBlank()) {
          prefs[KEY_THEME_MODE] = ThemeMode.SYSTEM.name
        }
      }
    }
    return preferences.first()
  }

  suspend fun setThemeMode(themeMode: ThemeMode) {
    context.dataStore.edit { prefs ->
      prefs[KEY_THEME_MODE] = themeMode.name
    }
  }

  suspend fun setApiBaseUrl(baseUrl: String) {
    context.dataStore.edit { prefs ->
      prefs[KEY_API_BASE_URL] = normalizeBaseUrl(baseUrl)
    }
  }

  private fun mapPreferences(preferences: Preferences): AppPreferences {
    val themeMode = runCatching {
      ThemeMode.valueOf(preferences[KEY_THEME_MODE].orEmpty().ifBlank { ThemeMode.SYSTEM.name })
    }.getOrDefault(ThemeMode.SYSTEM)

    return AppPreferences(
      apiBaseUrl = normalizeBaseUrl(preferences[KEY_API_BASE_URL].orEmpty()),
      themeMode = themeMode,
    )
  }

  private fun normalizeBaseUrl(value: String): String =
    value.trim().trimEnd('/')

  companion object {
    const val API_BASE_URL_KEY = "api_base_url"
    const val THEME_MODE_KEY = "theme_mode"

    private val KEY_API_BASE_URL = stringPreferencesKey(API_BASE_URL_KEY)
    private val KEY_THEME_MODE = stringPreferencesKey(THEME_MODE_KEY)
  }
}
