package com.xyzw.helper.data.repository

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.TokenManagementApi
import com.xyzw.helper.data.session.UserSensitiveActionSession
import com.xyzw.helper.data.storage.SecureTokenWorkspaceStore
import com.xyzw.helper.data.token.MAX_BIN_UPLOAD_BYTES
import com.xyzw.helper.data.token.validateBinUploadSize
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
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import retrofit2.create
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream

@RunWith(RobolectricTestRunner::class)
class TokenManagementRepositoryTest {
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
  fun `proxy import extracts complete token payload`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/token-import/proxy" -> {
            assertEquals("POST", request.method)
            jsonResponse(
              200,
              """{"success":true,"data":{"token":"{\"roleId\":\"role-1\",\"name\":\"Alice\",\"region\":\"一区\",\"sessId\":\"sess-1\"}"}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<TokenManagementApi>()
    val repository = TokenManagementRepository(
      api = api,
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )

    val result = repository.proxyImport("https://trusted.example.com/token.json")

    assertTrue(result is ApiResult.Success<*>)
    result as ApiResult.Success
    assertEquals(1, result.data.size)
  }

  @Test
  fun `download ticket uses in memory confirm token and streams bytes to output`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files/token-1/download-ticket" -> {
            assertEquals("user-confirm-1", request.getHeader("x-user-confirm-token"))
            jsonResponse(
              200,
              """{"success":true,"data":{"ticket":"ticket-1","expiresAt":"2099-01-01T00:00:00Z","tokenId":"token-1"}}""",
            )
          }
          "/api/v1/bin-files/token-1/download" -> {
            assertEquals("POST", request.method)
            binaryResponse(byteArrayOf(1, 2, 3, 4))
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_2", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val sensitiveActionSession = UserSensitiveActionSession().apply {
      store("user-confirm-1", "2099-01-01T00:00:00Z")
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val api = harness.retrofit.create<TokenManagementApi>()
    val repository = TokenManagementRepository(
      api = api,
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = sensitiveActionSession,
    )

    val ticketResult = repository.createDownloadTicket("token-1")
    assertTrue(ticketResult is ApiResult.Success<*>)

    val output = ByteArrayOutputStream()
    val downloadResult = repository.downloadBinFile("token-1", "ticket-1") { output }
    assertTrue(downloadResult is ApiResult.Success<*>)
    assertEquals(listOf(1, 2, 3, 4), output.toByteArray().map { it.toInt() })
  }

  @Test
  fun `download ticket forbidden when remote bin download is disabled`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files/token-1/download-ticket" -> jsonResponse(
            403,
            """{"success":false,"message":"未开启远程二进制文件导出，请先前往个人设置开启","error":{"code":"REMOTE_BIN_DISABLED","message":"未开启远程二进制文件导出"}}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_forbidden", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val sensitiveActionSession = UserSensitiveActionSession().apply {
      store("user-confirm-1", "2099-01-01T00:00:00Z")
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = TokenManagementRepository(
      api = harness.retrofit.create(),
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = sensitiveActionSession,
    )

    val ticketResult = repository.createDownloadTicket("token-1")

    assertTrue(ticketResult is ApiResult.Failure)
    ticketResult as ApiResult.Failure
    assertEquals(403, ticketResult.error.httpStatus)
    assertTrue(ticketResult.error.message.contains("未开启远程二进制文件导出"))
  }

  @Test
  fun `expired download ticket returns failure without writing output`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files/token-1/download" -> jsonResponse(
            403,
            """{"success":false,"message":"下载票据无效、过期或已使用，请重新申请"}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_expired", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = TokenManagementRepository(
      api = harness.retrofit.create(),
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )
    val output = ByteArrayOutputStream()

    val result = repository.downloadBinFile("token-1", "expired-ticket") { output }

    assertTrue(result is ApiResult.Failure)
    assertEquals(0, output.size())
  }

  @Test
  fun `bin upload streams request body and preserves content length`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files/token-1" -> {
            assertEquals("PUT", request.method)
            assertEquals("4", request.getHeader("Content-Length"))
            assertEquals("application/octet-stream", request.getHeader("Content-Type"))
            assertEquals("bin!", request.body.readUtf8())
            jsonResponse(
              200,
              """{"success":true,"data":{"tokenId":"token-1","size":4,"checksum":"ok"}}""",
            )
          }
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_3", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = TokenManagementRepository(
      api = harness.retrofit.create(),
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )

    val result = repository.uploadBinFile(
      tokenId = "token-1",
      contentLength = 4,
      inputStreamProvider = { ByteArrayInputStream("bin!".toByteArray()) },
    )

    assertTrue(result is ApiResult.Success<*>)
  }

  @Test
  fun `download write failure returns failure without crashing`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files/token-1/download" -> binaryResponse(byteArrayOf(1, 2, 3, 4))
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_write_failure", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = TokenManagementRepository(
      api = harness.retrofit.create(),
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )

    val result = repository.downloadBinFile("token-1", "ticket-1") {
      object : OutputStream() {
        override fun write(b: Int) {
          throw IOException("disk full")
        }
      }
    }

    assertTrue(result is ApiResult.Failure)
    result as ApiResult.Failure
    assertTrue(result.error.message.contains("二进制文件写入失败"))
  }

  @Test
  fun `list bin files restores missing local token shells from remote bins`() = runBlocking {
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse =
        when (request.path) {
          "/api/v1/bin-files" -> jsonResponse(
            200,
            """{"success":true,"data":[{"tokenId":"token-1","fileName":"token-1.bin","size":4,"createdAt":"2026-04-19T00:00:00Z","updatedAt":"2026-04-19T01:00:00Z"}]}""",
          )
          "/api/v1/token-activations/my" -> jsonResponse(
            200,
            """{"success":true,"data":[{"id":"bind-1","tokenId":"token-1","roleId":"role-1","roleName":"Alice","region":"一区","roleIndex":"1","expiresAt":"2099-01-01T00:00:00Z","boundAt":"2026-04-19T00:00:00Z","active":true}]}""",
          )
          else -> MockResponse().setResponseCode(404)
        }
    }

    val context = ApplicationProvider.getApplicationContext<Context>()
    val preferences = context.getSharedPreferences("tm_repo_test_restore_remote_bins", Context.MODE_PRIVATE).apply {
      edit().clear().commit()
    }
    val harness = createRepositoryHarness(server.url("/api/v1/"))
    val repository = TokenManagementRepository(
      api = harness.retrofit.create(),
      parser = ApiResultParser(),
      store = SecureTokenWorkspaceStore(context, preferences),
      sensitiveActionSession = UserSensitiveActionSession(),
    )

    val result = repository.listBinFiles()

    assertTrue(result is ApiResult.Success<*>)
    val restored = repository.tokens.value.single()
    assertEquals("token-1", restored.id)
    assertEquals("", restored.rawToken)
    assertEquals("Alice", restored.displayName)
    assertEquals("role-1", restored.roleId)
    assertEquals("一区", restored.region)
    assertEquals("1", restored.roleIndex)
    assertEquals(true, restored.activationActive)
    assertEquals(true, restored.activationBound)
    assertEquals(true, restored.binFilePresent)
  }

  @Test
  fun `bin upload policy rejects files above max size but allows unknown size`() {
    assertEquals(null, validateBinUploadSize(null))
    assertEquals(null, validateBinUploadSize(-1))
    assertEquals(null, validateBinUploadSize(MAX_BIN_UPLOAD_BYTES))
    assertEquals("二进制文件超过 32MB 上限，请选择更小的文件", validateBinUploadSize(MAX_BIN_UPLOAD_BYTES + 1))
  }
}
