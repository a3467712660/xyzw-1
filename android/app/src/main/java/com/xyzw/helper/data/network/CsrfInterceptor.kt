package com.xyzw.helper.data.network

import okhttp3.CookieJar
import okhttp3.Interceptor
import okhttp3.Response

class CsrfInterceptor(
  private val cookieJar: CookieJar,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val request = chain.request()
    val method = request.method.uppercase()
    if (method in SAFE_METHODS) {
      return chain.proceed(request)
    }

    val csrfToken = cookieJar
      .loadForRequest(request.url)
      .firstOrNull { it.name in CSRF_COOKIE_NAMES }
      ?.value

    val nextRequest = if (csrfToken.isNullOrBlank()) {
      request
    } else {
      request.newBuilder()
        .header("X-CSRF-Token", csrfToken)
        .build()
    }

    return chain.proceed(nextRequest)
  }

  private companion object {
    val SAFE_METHODS = setOf("GET", "HEAD", "OPTIONS", "TRACE")
    val CSRF_COOKIE_NAMES = setOf("__Host-xyzw_csrf_token", "xyzw_csrf_token")
  }
}
