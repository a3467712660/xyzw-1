package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.NetworkFactory
import com.xyzw.helper.data.session.InMemoryCookieStore
import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
import okhttp3.Dispatcher
import okhttp3.HttpUrl
import okhttp3.mockwebserver.MockResponse
import okio.Buffer
import retrofit2.Retrofit

internal data class RepositoryHarness(
  val sessionManager: SessionManager,
  val cookieJar: SecureCookieJar,
  val retrofit: Retrofit,
)

internal fun createRepositoryHarness(baseUrl: HttpUrl): RepositoryHarness {
  val sessionManager = SessionManager()
  val cookieJar = SecureCookieJar(InMemoryCookieStore())
  val refreshClient = NetworkFactory.createRefreshClient(cookieJar)
  val mainClient = NetworkFactory.createMainClient(
    cookieJar = cookieJar,
    sessionManager = sessionManager,
    baseUrl = baseUrl,
    refreshClient = refreshClient,
    dispatcher = Dispatcher(),
  )
  val retrofit = Retrofit.Builder()
    .baseUrl(baseUrl)
    .client(mainClient)
    .addConverterFactory(NetworkFactory.serializationConverter())
    .build()

  return RepositoryHarness(
    sessionManager = sessionManager,
    cookieJar = cookieJar,
    retrofit = retrofit,
  )
}

internal fun jsonResponse(
  code: Int,
  body: String,
  cookies: List<String> = emptyList(),
): MockResponse {
  val response = MockResponse()
    .setResponseCode(code)
    .setHeader("Content-Type", "application/json")
    .setBody(body)
  cookies.forEach { cookie ->
    response.addHeader("Set-Cookie", cookie)
  }
  return response
}

internal fun binaryResponse(
  bytes: ByteArray,
  contentType: String = "application/octet-stream",
): MockResponse =
  MockResponse()
    .setResponseCode(200)
    .setHeader("Content-Type", contentType)
    .setBody(Buffer().write(bytes))
