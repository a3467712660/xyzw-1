package com.xyzw.helper.data.network

import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import okhttp3.HttpUrl

class SessionAuthenticator(
  private val baseUrl: HttpUrl,
  private val refreshClient: OkHttpClient,
  private val cookieJar: SecureCookieJar,
  private val sessionManager: SessionManager,
) : Authenticator {
  private val lock = Any()

  override fun authenticate(route: Route?, response: Response): Request? {
    if (response.request.header(SKIP_REFRESH_HEADER) == "1") {
      return null
    }
    if (responseCount(response) >= 2) {
      return null
    }

    synchronized(lock) {
      val refreshRequest = Request.Builder()
        .url(baseUrl.resolve("auth/refresh") ?: return null)
        .header(SKIP_REFRESH_HEADER, "1")
        .post("{}".toRequestBody("application/json".toMediaType()))
        .build()

      refreshClient.newCall(refreshRequest).execute().use { refreshResponse ->
        if (!refreshResponse.isSuccessful) {
          cookieJar.clear()
          sessionManager.clearSession()
          return null
        }
      }
      return response.request.newBuilder().build()
    }
  }

  private fun responseCount(response: Response): Int {
    var count = 1
    var prior = response.priorResponse
    while (prior != null) {
      count += 1
      prior = prior.priorResponse
    }
    return count
  }
}
