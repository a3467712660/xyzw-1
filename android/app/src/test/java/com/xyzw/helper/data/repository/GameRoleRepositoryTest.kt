package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.GameRoleApi
import com.xyzw.helper.data.network.GameRoleUpsertRequest
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.create

class GameRoleRepositoryTest {
  private lateinit var server: MockWebServer

  @Before
  fun setUp() {
    server = MockWebServer()
    server.start()
  }

  @After
  fun tearDown() {
    server.shutdown()
  }

  @Test
  fun `list roles parses backend payload`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/gamerole_list" -> jsonResponse(
            200,
            """
            {"success":true,"data":[{"id":"role-1","name":"Alice","server":"一区","profession":"法师","level":88,"account":"acc","note":"note","avatar":"/a.png","isActive":true,"exp":10,"gold":12,"vip":false}]}
            """.trimIndent(),
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<GameRoleApi>()
    val repository = GameRoleRepository(api, ApiResultParser())
    val result = repository.listRoles()

    assertTrue(result is com.xyzw.helper.data.network.ApiResult.Success<*>)
    result as com.xyzw.helper.data.network.ApiResult.Success
    assertEquals(1, result.data.size)
    assertEquals("Alice", result.data.first().name)
  }

  @Test
  fun `create role sends post request`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/gameroles" -> {
            assertEquals("POST", request.method)
            jsonResponse(
              200,
              """
              {"success":true,"data":{"id":"role-2","name":"Bob","server":"二区","profession":"战士","level":60,"account":"","note":"","avatar":"/icons/xiaoyugan.png","isActive":true,"exp":0,"gold":0,"vip":false}}
              """.trimIndent(),
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<GameRoleApi>()
    val repository = GameRoleRepository(api, ApiResultParser())
    val result = repository.createRole(
      name = "Bob",
      server = "二区",
      profession = "战士",
      level = 1,
      account = "",
      note = "",
      avatar = "/icons/xiaoyugan.png",
    )

    assertTrue(result is com.xyzw.helper.data.network.ApiResult.Success<*>)
  }
}
