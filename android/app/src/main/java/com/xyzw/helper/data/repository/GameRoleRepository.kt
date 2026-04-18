package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameRoleApi

class GameRoleRepository(
  private val api: GameRoleApi,
  private val parser: ApiResultParser,
) {
  suspend fun listRoles(): ApiResult<List<GameRole>> =
    parser.parse(api.listRoles())
}
