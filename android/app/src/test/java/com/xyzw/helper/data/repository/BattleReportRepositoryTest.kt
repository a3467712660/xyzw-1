package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.BattleReportApi
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

class BattleReportRepositoryTest {
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
  fun `catalog query and parse succeed`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/battle-reports/catalog" -> jsonResponse(
            200,
            """{"success":true,"data":{"types":[{"id":"salt-field","title":"盐场战报","description":"查询盐场战绩"}]}}""",
          )
          "/api/v1/battle-reports/token-1/query" -> {
            assertEquals("POST", request.method)
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"reportType\":\"salt-field\""))
            jsonResponse(
              200,
              """{"success":true,"data":{"reports":[{"id":"r-1","reportType":"salt-field","title":"战报","summary":"胜利","createdAt":"2026-04-19T00:00:00Z","detail":{"winner":"A"}}]}}""",
            )
          }
          "/api/v1/battle-reports/parse" -> {
            assertEquals("POST", request.method)
            jsonResponse(
              200,
              """{"success":true,"data":{"report":{"id":"parsed-1","reportType":"manual","title":"手动战报","summary":"已解析","detail":{"winner":"A"}}}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = BattleReportRepository(
      api = harness.retrofit.create<BattleReportApi>(),
      parser = ApiResultParser(),
    )

    assertTrue(repository.getCatalog() is ApiResult.Success<*>)
    assertTrue(repository.queryReports("token-1", "salt-field", "2026-04-19") is ApiResult.Success<*>)
    assertTrue(repository.parseReport("""{"winner":"A"}""") is ApiResult.Success<*>)
  }

  @Test
  fun `query reports maps 200020 error body to no data success`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/battle-reports/token-1/query" -> jsonResponse(
            400,
            """{"success":false,"message":"200020","error":{"code":"200020","message":"200020"}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = BattleReportRepository(harness.retrofit.create(), ApiResultParser())

    val result = repository.queryReports("token-1", "peach-garden", "2026-04-19")

    assertTrue(result is ApiResult.Success)
    val payload = (result as ApiResult.Success).data
    assertTrue(payload.reports.isEmpty())
    assertEquals("200020", payload.businessCode)
    assertEquals("当天暂无战报，可能未参加或战报尚未生成", payload.emptyReason)
  }

  @Test
  fun `parse and network failures are surfaced`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/battle-reports/parse" -> jsonResponse(
            400,
            """{"success":false,"message":"战报格式不支持"}""",
          )
          "/api/v1/battle-reports/token-1/query" -> MockResponse().setResponseCode(503)
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = BattleReportRepository(harness.retrofit.create(), ApiResultParser())

    assertTrue(repository.parseReport("not-json") is ApiResult.Failure)
    assertTrue(repository.queryReports("token-1", "salt-field", "2026-04-19") is ApiResult.Failure)
  }

  @Test
  fun `invalid parse failure uses friendly battle report message`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/battle-reports/parse" -> jsonResponse(
            400,
            """{"success":false,"error":{"code":"BATTLE_REPORT_UNSUPPORTED","message":"raw json invalid"}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = BattleReportRepository(harness.retrofit.create(), ApiResultParser())
    val result = repository.parseReport("not-json")

    assertTrue(result is ApiResult.Failure)
    assertEquals("战报格式不支持，请检查粘贴内容", (result as ApiResult.Failure).error.message)
  }
}
