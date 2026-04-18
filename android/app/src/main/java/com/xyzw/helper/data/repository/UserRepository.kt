package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.UserApi

class UserRepository(
  private val userApi: UserApi,
  private val parser: ApiResultParser,
) {
  suspend fun getProfile(): ApiResult<AuthUser> =
    parser.parse(userApi.getProfile())
}
