package com.xyzw.helper.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ViewList
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.xyzw.helper.app.AppContainer
import com.xyzw.helper.ui.screens.AuthEvent
import com.xyzw.helper.ui.screens.AuthViewModel
import com.xyzw.helper.ui.screens.AdminActivationCodesScreen
import com.xyzw.helper.ui.screens.AdminActivationCodesViewModel
import com.xyzw.helper.ui.screens.AdminChangelogBroadcastScreen
import com.xyzw.helper.ui.screens.AdminChangelogBroadcastViewModel
import com.xyzw.helper.ui.screens.AdminFeedbackTicketsScreen
import com.xyzw.helper.ui.screens.AdminFeedbackTicketsViewModel
import com.xyzw.helper.ui.screens.AdminHubScreen
import com.xyzw.helper.ui.screens.AdminInvitesScreen
import com.xyzw.helper.ui.screens.AdminInvitesViewModel
import com.xyzw.helper.ui.screens.AdminReferralsScreen
import com.xyzw.helper.ui.screens.AdminReferralsViewModel
import com.xyzw.helper.ui.screens.AdminTaskControlLogsScreen
import com.xyzw.helper.ui.screens.AdminTaskControlLogsViewModel
import com.xyzw.helper.ui.screens.AdminUsersScreen
import com.xyzw.helper.ui.screens.AdminUsersViewModel
import com.xyzw.helper.ui.screens.AdminWechatContactsScreen
import com.xyzw.helper.ui.screens.AdminWechatContactsViewModel
import com.xyzw.helper.ui.screens.DashboardScreen
import com.xyzw.helper.ui.screens.DashboardViewModel
import com.xyzw.helper.ui.screens.ForgotPasswordScreen
import com.xyzw.helper.ui.screens.LoginScreen
import com.xyzw.helper.ui.screens.MfaVerifyScreen
import com.xyzw.helper.ui.screens.NotificationsScreen
import com.xyzw.helper.ui.screens.NotificationsViewModel
import com.xyzw.helper.ui.screens.PlaceholderScreen
import com.xyzw.helper.ui.screens.ProfileScreen
import com.xyzw.helper.ui.screens.RegisterScreen
import com.xyzw.helper.ui.screens.RolesScreen
import com.xyzw.helper.ui.screens.RolesViewModel
import com.xyzw.helper.ui.screens.SplashDestination
import com.xyzw.helper.ui.screens.SplashScreen
import com.xyzw.helper.ui.screens.SplashViewModel
import com.xyzw.helper.ui.screens.buildAdminEntrySpec
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@Composable
fun XyzwHelperApp(
  container: AppContainer,
) {
  val rootNavController = rememberNavController()
  val authViewModel: AuthViewModel = viewModel(factory = container.viewModelFactory)
  val authUiState by authViewModel.uiState.collectAsStateWithLifecycle()

  LaunchedEffect(authViewModel) {
    authViewModel.events.collectLatest { event ->
      when (event) {
        AuthEvent.NavigateMain -> {
          rootNavController.navigate(AppRoute.MainGraph.route) {
            popUpTo(0) { inclusive = true }
          }
        }

        AuthEvent.NavigateMfa -> {
          rootNavController.navigate(AppRoute.MfaVerify.route)
        }

        AuthEvent.NavigateLogin -> {
          rootNavController.navigate(AppRoute.AuthGraph.route) {
            popUpTo(0) { inclusive = true }
          }
        }
      }
    }
  }

  NavHost(
    navController = rootNavController,
    startDestination = AppRoute.Splash.route,
  ) {
    composable(AppRoute.Splash.route) {
      val splashViewModel: SplashViewModel = viewModel(factory = container.viewModelFactory)
      val splashState by splashViewModel.uiState.collectAsStateWithLifecycle()

      LaunchedEffect(splashState.destination) {
        when (splashState.destination) {
          SplashDestination.Login -> {
            rootNavController.navigate(AppRoute.AuthGraph.route) {
              popUpTo(AppRoute.Splash.route) { inclusive = true }
            }
          }

          SplashDestination.Main -> {
            rootNavController.navigate(AppRoute.MainGraph.route) {
              popUpTo(AppRoute.Splash.route) { inclusive = true }
            }
          }

          SplashDestination.Pending -> Unit
        }
      }
      SplashScreen()
    }

    navigation(
      route = AppRoute.AuthGraph.route,
      startDestination = AppRoute.Login.route,
    ) {
      composable(AppRoute.Login.route) {
        LoginScreen(
          uiState = authUiState,
          onSubmit = authViewModel::login,
          onRegister = { rootNavController.navigate(AppRoute.Register.route) },
          onForgotPassword = { rootNavController.navigate(AppRoute.ForgotPassword.route) },
        )
      }
      composable(AppRoute.MfaVerify.route) {
        MfaVerifyScreen(
          uiState = authUiState,
          onVerify = authViewModel::verifyMfa,
          onToggleRecoveryMode = authViewModel::toggleRecoveryMode,
        )
      }
      composable(AppRoute.Register.route) {
        RegisterScreen(
          uiState = authUiState,
          onSubmit = authViewModel::register,
        )
      }
      composable(AppRoute.ForgotPassword.route) {
        ForgotPasswordScreen(
          uiState = authUiState,
          onSubmit = authViewModel::resetPassword,
        )
      }
    }

    navigation(
      route = AppRoute.MainGraph.route,
      startDestination = AppRoute.MainShell.route,
    ) {
      composable(AppRoute.MainShell.route) {
        MainShell(
          container = container,
          authViewModel = authViewModel,
        )
      }
    }
  }
}

@Composable
private fun MainShell(
  container: AppContainer,
  authViewModel: AuthViewModel,
) {
  val shellNavController = rememberNavController()
  val dashboardViewModel: DashboardViewModel = viewModel(factory = container.viewModelFactory)
  val rolesViewModel: RolesViewModel = viewModel(factory = container.viewModelFactory)
  val notificationsViewModel: NotificationsViewModel = viewModel(factory = container.viewModelFactory)
  val dashboardState by dashboardViewModel.uiState.collectAsStateWithLifecycle()
  val rolesState by rolesViewModel.uiState.collectAsStateWithLifecycle()
  val notificationsState by notificationsViewModel.uiState.collectAsStateWithLifecycle()
  val currentUser = dashboardState.user
  val showAdminEntry = buildAdminEntrySpec(currentUser).showEntry
  val shellBackStackEntry by shellNavController.currentBackStackEntryAsState()
  val scope = rememberCoroutineScope()
  val preferences by container.preferencesStore.preferences.collectAsStateWithLifecycle(
    initialValue = container.initialPreferences,
  )

  val items = listOf(
    ShellDestination(AppRoute.Dashboard, "控制台", Icons.Outlined.Dashboard),
    ShellDestination(AppRoute.Roles, "角色", Icons.AutoMirrored.Outlined.ViewList),
    ShellDestination(AppRoute.Tasks, "任务", Icons.Outlined.TaskAlt),
    ShellDestination(AppRoute.Notifications, "通知", Icons.Outlined.Notifications),
    ShellDestination(AppRoute.Profile, "我的", Icons.Outlined.AccountCircle),
  )

  Scaffold(
    bottomBar = {
      NavigationBar {
        items.forEach { item ->
          val selected = shellBackStackEntry?.destination?.hierarchy?.any { it.route == item.route.route } == true
          NavigationBarItem(
            selected = selected,
            onClick = { shellNavController.navigate(item.route.route) },
            icon = { Icon(item.icon, contentDescription = item.label) },
            label = { Text(item.label) },
          )
        }
      }
    },
  ) { innerPadding ->
    NavHost(
      navController = shellNavController,
      startDestination = AppRoute.Dashboard.route,
      modifier = Modifier.padding(innerPadding),
    ) {
      composable(AppRoute.Dashboard.route) {
        DashboardScreen(
          uiState = dashboardState,
          showAdminEntry = showAdminEntry,
          onRefresh = dashboardViewModel::refresh,
          onOpenRoles = { shellNavController.navigate(AppRoute.Roles.route) },
          onOpenNotifications = { shellNavController.navigate(AppRoute.Notifications.route) },
          onOpenAdminHub = { shellNavController.navigate(AppRoute.AdminHub.route) },
        )
      }
      composable(AppRoute.AdminHub.route) {
        AdminHubScreen(
          currentUser = currentUser,
          onBack = { shellNavController.popBackStack() },
          onOpenUsers = { shellNavController.navigate(AppRoute.AdminUsers.route) },
          onOpenInvites = { shellNavController.navigate(AppRoute.AdminInvites.route) },
          onOpenActivationCodes = { shellNavController.navigate(AppRoute.AdminActivationCodes.route) },
          onOpenFeedbackTickets = { shellNavController.navigate(AppRoute.AdminFeedbackTickets.route) },
          onOpenTaskLogs = { shellNavController.navigate(AppRoute.AdminTaskControlLogs.route) },
          onOpenChangelogBroadcast = { shellNavController.navigate(AppRoute.AdminChangelogBroadcast.route) },
          onOpenWechatContacts = { shellNavController.navigate(AppRoute.AdminWechatContacts.route) },
          onOpenReferrals = { shellNavController.navigate(AppRoute.AdminReferrals.route) },
        )
      }
      composable(AppRoute.AdminUsers.route) {
        val adminUsersViewModel: AdminUsersViewModel = viewModel(factory = container.viewModelFactory)
        AdminUsersScreen(
          currentUser = currentUser,
          viewModel = adminUsersViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminInvites.route) {
        val adminInvitesViewModel: AdminInvitesViewModel = viewModel(factory = container.viewModelFactory)
        AdminInvitesScreen(
          currentUser = currentUser,
          viewModel = adminInvitesViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminActivationCodes.route) {
        val adminActivationCodesViewModel: AdminActivationCodesViewModel = viewModel(factory = container.viewModelFactory)
        AdminActivationCodesScreen(
          currentUser = currentUser,
          viewModel = adminActivationCodesViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminFeedbackTickets.route) {
        val adminFeedbackTicketsViewModel: AdminFeedbackTicketsViewModel = viewModel(factory = container.viewModelFactory)
        AdminFeedbackTicketsScreen(
          currentUser = currentUser,
          viewModel = adminFeedbackTicketsViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminTaskControlLogs.route) {
        val adminTaskControlLogsViewModel: AdminTaskControlLogsViewModel = viewModel(factory = container.viewModelFactory)
        AdminTaskControlLogsScreen(
          currentUser = currentUser,
          viewModel = adminTaskControlLogsViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminChangelogBroadcast.route) {
        val adminChangelogBroadcastViewModel: AdminChangelogBroadcastViewModel = viewModel(factory = container.viewModelFactory)
        AdminChangelogBroadcastScreen(
          currentUser = currentUser,
          viewModel = adminChangelogBroadcastViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminWechatContacts.route) {
        val adminWechatContactsViewModel: AdminWechatContactsViewModel = viewModel(factory = container.viewModelFactory)
        AdminWechatContactsScreen(
          currentUser = currentUser,
          viewModel = adminWechatContactsViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.AdminReferrals.route) {
        val adminReferralsViewModel: AdminReferralsViewModel = viewModel(factory = container.viewModelFactory)
        AdminReferralsScreen(
          currentUser = currentUser,
          viewModel = adminReferralsViewModel,
          onBack = { shellNavController.popBackStack() },
        )
      }
      composable(AppRoute.Roles.route) {
        RolesScreen(
          uiState = rolesState,
          onRefresh = rolesViewModel::refresh,
        )
      }
      composable(AppRoute.Tasks.route) {
        PlaceholderScreen(
          title = "任务",
          description = "首轮只预留导航结构。DailyTask / TaskControl repository 已接好，可在下一轮补完整原生页面。",
        )
      }
      composable(AppRoute.Notifications.route) {
        NotificationsScreen(
          uiState = notificationsState,
          onRefresh = notificationsViewModel::refresh,
          onMarkRead = notificationsViewModel::markRead,
          onMarkAllRead = notificationsViewModel::markAllRead,
        )
      }
      composable(AppRoute.Profile.route) {
        ProfileScreen(
          currentUsername = dashboardState.user?.username ?: "未登录",
          isAdmin = showAdminEntry,
          preferences = preferences,
          onThemeChange = { mode ->
            scope.launch { container.preferencesStore.setThemeMode(mode) }
          },
          onOpenAdminHub = { shellNavController.navigate(AppRoute.AdminHub.route) },
          onLogout = authViewModel::logout,
        )
      }
    }
  }
}

private data class ShellDestination(
  val route: AppRoute,
  val label: String,
  val icon: androidx.compose.ui.graphics.vector.ImageVector,
)
