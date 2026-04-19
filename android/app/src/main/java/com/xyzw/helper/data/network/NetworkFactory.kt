package com.xyzw.helper.data.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.xyzw.helper.BuildConfig
import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
import kotlinx.serialization.json.Json
import okhttp3.Dispatcher
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Converter
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

object NetworkFactory {
  val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    isLenient = true
  }

  fun serializationConverter(): Converter.Factory =
    json.asConverterFactory("application/json".toMediaType())

  fun createRefreshClient(
    cookieJar: SecureCookieJar,
    dispatcher: Dispatcher? = null,
  ): OkHttpClient = OkHttpClient.Builder()
    .cookieJar(cookieJar)
    .addInterceptor(CsrfInterceptor(cookieJar))
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .writeTimeout(15, TimeUnit.SECONDS)
    .apply {
      if (dispatcher != null) {
        dispatcher(dispatcher)
      }
    }
    .build()

  fun createMainClient(
    cookieJar: SecureCookieJar,
    sessionManager: SessionManager,
    baseUrl: HttpUrl,
    refreshClient: OkHttpClient,
    dispatcher: Dispatcher? = null,
  ): OkHttpClient {
    return OkHttpClient.Builder()
      .cookieJar(cookieJar)
      .addInterceptor(CsrfInterceptor(cookieJar))
      .apply {
        if (BuildConfig.DEBUG) {
          addInterceptor(
            HttpLoggingInterceptor().apply {
              level = HttpLoggingInterceptor.Level.BASIC
            },
          )
        }
      }
      .authenticator(
        SessionAuthenticator(
          baseUrl = baseUrl,
          refreshClient = refreshClient,
          cookieJar = cookieJar,
          sessionManager = sessionManager,
        ),
      )
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(15, TimeUnit.SECONDS)
      .writeTimeout(15, TimeUnit.SECONDS)
      .apply {
        if (dispatcher != null) {
          dispatcher(dispatcher)
        }
      }
      .build()
  }

  fun createRetrofit(
    baseUrl: HttpUrl,
    client: OkHttpClient,
  ): Retrofit = Retrofit.Builder()
    .baseUrl(baseUrl)
    .client(client)
    .addConverterFactory(serializationConverter())
    .build()
}
