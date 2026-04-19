package com.xyzw.helper.app

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.xyzw.helper.BuildConfig
import com.xyzw.helper.data.network.ApiResultParser
import com.xyzw.helper.data.network.AdminApi
import com.xyzw.helper.data.network.AuthApi
import com.xyzw.helper.data.network.AuthBootstrapHelper
import com.xyzw.helper.data.network.DailyTaskApi
import com.xyzw.helper.data.network.FeedbackApi
import com.xyzw.helper.data.network.GameRoleApi
import com.xyzw.helper.data.network.NetworkFactory
import com.xyzw.helper.data.network.NotificationApi
import com.xyzw.helper.data.network.SystemApi
import com.xyzw.helper.data.network.TaskControlApi
import com.xyzw.helper.data.network.TokenManagementApi
import com.xyzw.helper.data.network.UserApi
import com.xyzw.helper.data.repository.AdminRepository
import com.xyzw.helper.data.repository.AdminFeedbackRepository
import com.xyzw.helper.data.repository.AuthRepository
import com.xyzw.helper.data.repository.DailyTaskRepository
import com.xyzw.helper.data.repository.FeedbackUserRepository
import com.xyzw.helper.data.repository.GameRoleRepository
import com.xyzw.helper.data.repository.NotificationRepository
import com.xyzw.helper.data.repository.ProfileRepository
import com.xyzw.helper.data.repository.ReferralRepository
import com.xyzw.helper.data.repository.SystemRepository
import com.xyzw.helper.data.repository.TaskControlRepository
import com.xyzw.helper.data.repository.TokenManagementRepository
import com.xyzw.helper.data.repository.UserRepository
import com.xyzw.helper.data.session.EncryptedCookieStore
import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
import com.xyzw.helper.data.session.UserSensitiveActionSession
import com.xyzw.helper.data.storage.AppPreferences
import com.xyzw.helper.data.storage.AppPreferencesStore
import com.xyzw.helper.data.storage.SecureTokenWorkspaceStore
import com.xyzw.helper.ui.screens.AdminActivationCodesViewModel
import com.xyzw.helper.ui.screens.AdminChangelogBroadcastViewModel
import com.xyzw.helper.ui.screens.AdminFeedbackTicketsViewModel
import com.xyzw.helper.ui.screens.AdminInvitesViewModel
import com.xyzw.helper.ui.screens.AdminReferralsViewModel
import com.xyzw.helper.ui.screens.AdminTaskControlLogsViewModel
import com.xyzw.helper.ui.screens.AdminUsersViewModel
import com.xyzw.helper.ui.screens.AdminWechatContactsViewModel
import com.xyzw.helper.ui.screens.AuthViewModel
import com.xyzw.helper.ui.screens.DashboardViewModel
import com.xyzw.helper.ui.screens.DailyTasksViewModel
import com.xyzw.helper.ui.screens.FeedbackViewModel
import com.xyzw.helper.ui.screens.NotificationsViewModel
import com.xyzw.helper.ui.screens.ProfileSettingsViewModel
import com.xyzw.helper.ui.screens.ReferralViewModel
import com.xyzw.helper.ui.screens.RoleManagementViewModel
import com.xyzw.helper.ui.screens.SplashViewModel
import com.xyzw.helper.ui.screens.TaskControlViewModel
import com.xyzw.helper.ui.screens.TokenManagementViewModel
import com.xyzw.helper.websocket.WsSessionManager
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrl
import retrofit2.create

class AppContainer(
  context: Context,
) {
  val preferencesStore = AppPreferencesStore(context)
  val initialPreferences: AppPreferences = runBlocking {
    preferencesStore.ensureDefaults(BuildConfig.DEFAULT_API_BASE_URL)
  }
  val sessionManager = SessionManager()
  val cookieJar = SecureCookieJar(EncryptedCookieStore(context))
  val sensitiveActionSession = UserSensitiveActionSession()
  val tokenWorkspaceStore = SecureTokenWorkspaceStore(context)
  val parser = ApiResultParser()

  val serverBaseUrl: String = validateServerBaseUrl(initialPreferences.apiBaseUrl)
  private val apiBaseUrl = "$serverBaseUrl/api/v1/".toHttpUrl()

  private val refreshClient = NetworkFactory.createRefreshClient(cookieJar)
  private val mainClient = NetworkFactory.createMainClient(
    cookieJar = cookieJar,
    sessionManager = sessionManager,
    baseUrl = apiBaseUrl,
    refreshClient = refreshClient,
  )
  private val retrofit = NetworkFactory.createRetrofit(apiBaseUrl, mainClient)

  private val authApi = retrofit.create<AuthApi>()
  private val userApi = retrofit.create<UserApi>()
  private val systemApi = retrofit.create<SystemApi>()
  private val gameRoleApi = retrofit.create<GameRoleApi>()
  private val dailyTaskApi = retrofit.create<DailyTaskApi>()
  private val taskControlApi = retrofit.create<TaskControlApi>()
  private val notificationApi = retrofit.create<NotificationApi>()
  private val feedbackApi = retrofit.create<FeedbackApi>()
  private val adminApi = retrofit.create<AdminApi>()
  private val tokenManagementApi = retrofit.create<TokenManagementApi>()
  val wsSessionManager = WsSessionManager(
    client = mainClient,
    serverBaseUrl = serverBaseUrl,
    wsPath = BuildConfig.DEFAULT_WS_PATH,
    wsOrigin = BuildConfig.DEFAULT_WS_ORIGIN,
  )
  val realtimeCoordinator = RealtimeCoordinator(
    sessionManager = sessionManager,
    wsSessionManager = wsSessionManager,
  )
  val localSessionController = LocalSessionController(
    cookieJar = cookieJar,
    sessionManager = sessionManager,
    sensitiveActionSession = sensitiveActionSession,
  )

  val authRepository = AuthRepository(
    authApi = authApi,
    sessionManager = sessionManager,
    authBootstrapHelper = AuthBootstrapHelper(authApi, parser),
    parser = parser,
  )
  val userRepository = UserRepository(userApi, parser)
  val systemRepository = SystemRepository(systemApi, parser)
  val gameRoleRepository = GameRoleRepository(gameRoleApi, parser)
  val dailyTaskRepository = DailyTaskRepository(dailyTaskApi, parser)
  val taskControlRepository = TaskControlRepository(taskControlApi, parser)
  val notificationRepository = NotificationRepository(notificationApi, parser)
  val feedbackUserRepository = FeedbackUserRepository(feedbackApi, parser)
  val adminFeedbackRepository = AdminFeedbackRepository(feedbackApi, parser)
  val profileRepository = ProfileRepository(
    api = userApi,
    parser = parser,
    sensitiveActionSession = sensitiveActionSession,
  )
  val referralRepository = ReferralRepository(userApi, parser)
  val tokenManagementRepository = TokenManagementRepository(
    api = tokenManagementApi,
    parser = parser,
    store = tokenWorkspaceStore,
    sensitiveActionSession = sensitiveActionSession,
  )
  val adminRepository = AdminRepository(adminApi, parser)

  val viewModelFactory: ViewModelProvider.Factory = AppViewModelFactory(this)

  private fun validateServerBaseUrl(rawValue: String): String {
    val normalized = rawValue.trim().trimEnd('/')
    require(normalized.isNotBlank()) {
      "API base URL must not be blank."
    }
    if (!BuildConfig.DEBUG) {
      require(normalized.startsWith("https://")) {
        "Release builds require an HTTPS API base URL."
      }
    }
    return normalized
  }
}

class AppViewModelFactory(
  private val container: AppContainer,
) : ViewModelProvider.Factory {
  @Suppress("UNCHECKED_CAST")
  override fun <T : ViewModel> create(modelClass: Class<T>): T =
    when {
      modelClass.isAssignableFrom(SplashViewModel::class.java) -> SplashViewModel(
        authRepository = container.authRepository,
      ) as T

      modelClass.isAssignableFrom(AuthViewModel::class.java) -> AuthViewModel(
        authRepository = container.authRepository,
        sessionManager = container.sessionManager,
        localSessionController = container.localSessionController,
      ) as T

      modelClass.isAssignableFrom(DashboardViewModel::class.java) -> DashboardViewModel(
        sessionManager = container.sessionManager,
        systemRepository = container.systemRepository,
        realtimeCoordinator = container.realtimeCoordinator,
      ) as T

      modelClass.isAssignableFrom(RoleManagementViewModel::class.java) -> RoleManagementViewModel(
        repository = container.gameRoleRepository,
      ) as T

      modelClass.isAssignableFrom(NotificationsViewModel::class.java) -> NotificationsViewModel(
        repository = container.notificationRepository,
        realtimeCoordinator = container.realtimeCoordinator,
      ) as T

      modelClass.isAssignableFrom(TokenManagementViewModel::class.java) -> TokenManagementViewModel(
        repository = container.tokenManagementRepository,
        profileRepository = container.profileRepository,
      ) as T

      modelClass.isAssignableFrom(DailyTasksViewModel::class.java) -> DailyTasksViewModel(
        roleRepository = container.gameRoleRepository,
        dailyTaskRepository = container.dailyTaskRepository,
      ) as T

      modelClass.isAssignableFrom(TaskControlViewModel::class.java) -> TaskControlViewModel(
        repository = container.taskControlRepository,
        realtimeCoordinator = container.realtimeCoordinator,
      ) as T

      modelClass.isAssignableFrom(FeedbackViewModel::class.java) -> FeedbackViewModel(
        repository = container.feedbackUserRepository,
      ) as T

      modelClass.isAssignableFrom(ProfileSettingsViewModel::class.java) -> ProfileSettingsViewModel(
        repository = container.profileRepository,
        preferencesStore = container.preferencesStore,
        localSessionController = container.localSessionController,
      ) as T

      modelClass.isAssignableFrom(ReferralViewModel::class.java) -> ReferralViewModel(
        repository = container.referralRepository,
      ) as T

      modelClass.isAssignableFrom(AdminUsersViewModel::class.java) -> AdminUsersViewModel(
        repository = container.adminRepository,
      ) as T

      modelClass.isAssignableFrom(AdminInvitesViewModel::class.java) -> AdminInvitesViewModel(
        repository = container.adminRepository,
      ) as T

      modelClass.isAssignableFrom(AdminActivationCodesViewModel::class.java) -> AdminActivationCodesViewModel(
        repository = container.adminRepository,
      ) as T

      modelClass.isAssignableFrom(AdminFeedbackTicketsViewModel::class.java) -> AdminFeedbackTicketsViewModel(
        feedbackRepository = container.adminFeedbackRepository,
      ) as T

      modelClass.isAssignableFrom(AdminTaskControlLogsViewModel::class.java) -> AdminTaskControlLogsViewModel(
        repository = container.adminRepository,
      ) as T

      modelClass.isAssignableFrom(AdminChangelogBroadcastViewModel::class.java) -> AdminChangelogBroadcastViewModel(
        repository = container.adminRepository,
      ) as T

      modelClass.isAssignableFrom(AdminWechatContactsViewModel::class.java) -> AdminWechatContactsViewModel(
        repository = container.adminRepository,
      ) as T

      modelClass.isAssignableFrom(AdminReferralsViewModel::class.java) -> AdminReferralsViewModel(
        repository = container.adminRepository,
      ) as T

      else -> error("Unsupported ViewModel class: ${modelClass.name}")
    }
}
