package com.xyzw.helper.data.repository

import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameRoleApi
import com.xyzw.helper.data.network.GameRoleUpsertRequest

class GameRoleRepository(
  private val api: GameRoleApi,
  private val parser: ApiResultParser,
) {
  suspend fun listRoles(): ApiResult<List<GameRole>> =
    parser.parse(api.listRoles())

  suspend fun getRoleDetail(roleId: String): ApiResult<GameRole> =
    parser.parse(api.getRoleDetail(roleId))

  suspend fun createRole(
    name: String,
    server: String,
    profession: String,
    level: Int,
    account: String,
    note: String,
    avatar: String,
  ): ApiResult<GameRole> =
    parser.parse(
      api.createRole(
        GameRoleUpsertRequest(
          name = name,
          server = server,
          profession = profession,
          level = level,
          account = account,
          note = note,
          avatar = avatar,
        ),
      ),
    )

  suspend fun updateRole(
    roleId: String,
    request: GameRoleUpsertRequest,
  ): ApiResult<GameRole> =
    parser.parse(api.updateRole(roleId, request))

  suspend fun deleteRole(roleId: String): ApiResult<Unit> =
    parser.parseUnit(api.deleteRole(roleId))
}
