package com.xyzw.helper.data.network

import com.xyzw.helper.data.model.CsrfPayload
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class AuthBootstrapHelper(
  private val authApi: AuthApi,
  private val parser: ApiResultParser,
) {
  private val mutex = Mutex()

  suspend fun ensureCsrf(): ApiResult<CsrfPayload> = mutex.withLock {
    parser.parse(authApi.ensureCsrf())
  }
}
