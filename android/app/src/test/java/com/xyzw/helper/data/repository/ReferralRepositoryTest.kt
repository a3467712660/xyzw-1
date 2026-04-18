package com.xyzw.helper.data.repository

import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.UserApi
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

class ReferralRepositoryTest {
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
  fun `overview and generate profile parse`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/user/referral-overview" -> jsonResponse(
            200,
            """{"success":true,"data":{"profile":null,"invitedUsersCount":2,"pendingAmountCents":1200,"paidAmountCents":800}}""",
          )
          "/api/v1/user/referral-profile/generate" -> jsonResponse(
            200,
            """{"success":true,"data":{"id":"ref-1","userId":"u-1","referralCode":"ABC123","shareUrl":"https://example.com/r/ABC123","createdAt":"2026-04-19T00:00:00Z","updatedAt":"2026-04-19T00:00:00Z"}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<UserApi>()
    val repository = ReferralRepository(api, ApiResultParser())

    val overview = repository.getReferralOverview()
    val generated = repository.generateReferralProfile()

    assertTrue(overview is ApiResult.Success<*>)
    overview as ApiResult.Success
    assertEquals(2, overview.data.invitedUsersCount)
    assertTrue(generated is ApiResult.Success<*>)
  }
}
