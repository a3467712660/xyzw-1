package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.xyzw.helper.data.model.ActivationCodeItem
import com.xyzw.helper.data.model.AdminConfirmCredential
import com.xyzw.helper.data.model.AdminPasswordResetCodePayload
import com.xyzw.helper.data.model.AdminTaskControlLogsQuery
import com.xyzw.helper.data.model.AdminUserItem
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.model.FeedbackItem
import com.xyzw.helper.data.model.InviteCodeItem
import com.xyzw.helper.data.model.ReferralConversionItem
import com.xyzw.helper.data.model.WechatContactAdminItem
import com.xyzw.helper.data.network.AdminWechatContactRequest
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.ui.components.XyzwConfirmDialog
import com.xyzw.helper.ui.components.XyzwExpandableText
import com.xyzw.helper.ui.components.XyzwStatusChip
import com.xyzw.helper.ui.components.SensitiveValueText
import com.xyzw.helper.ui.formatters.formatDisplayDateTime
import kotlinx.coroutines.launch
import kotlin.math.max

@Composable
fun AdminHubScreen(
  currentUser: AuthUser?,
  onBack: () -> Unit,
  onOpenUsers: () -> Unit,
  onOpenInvites: () -> Unit,
  onOpenActivationCodes: () -> Unit,
  onOpenFeedbackTickets: () -> Unit,
  onOpenTaskLogs: () -> Unit,
  onOpenChangelogBroadcast: () -> Unit,
  onOpenWechatContacts: () -> Unit,
  onOpenReferrals: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }

  val entries = listOf(
    "用户管理" to Pair("账号权限、密码、会话与多重验证重置", onOpenUsers),
    "邀请码" to Pair("查看、创建与禁用邀请码", onOpenInvites),
    "激活码" to Pair("创建、解绑、禁用和删除激活码", onOpenActivationCodes),
    "工单管理" to Pair("处理用户工单和状态更新", onOpenFeedbackTickets),
    "后端任务日志" to Pair("按账号/任务/状态筛选任务日志", onOpenTaskLogs),
    "更新日志广播" to Pair("向全部账户发送更新日志通知", onOpenChangelogBroadcast),
    "微信联系配置" to Pair("维护价格菜单的微信联系人入口", onOpenWechatContacts),
    "推广归因" to Pair("查看归因和返佣转化处理", onOpenReferrals),
  )

  AdminScreenScaffold(
    title = "管理员中心",
    onBack = onBack,
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminCardSection(
          title = "管理员入口",
          subtitle = "仅当前账号为管理员时显示。所有页面均为原生安卓界面实现。",
        ) {
          Text(currentUser?.username ?: "未登录", style = MaterialTheme.typography.titleLarge)
          Text(
            "当前权限范围：${accessScopeLabel(currentUser?.accessScope)}",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
      items(entries, key = { it.first }) { entry ->
        val description = entry.second.first
        val action = entry.second.second
        AdminCardSection(
          title = entry.first,
          subtitle = description,
        ) {
          Button(onClick = action, modifier = Modifier.fillMaxWidth()) {
            Text("进入")
          }
        }
      }
    }
  }
}

@Composable
fun AdminUsersScreen(
  currentUser: AuthUser?,
  viewModel: AdminUsersViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }

  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var confirmRequest by remember { mutableStateOf<AdminConfirmDialogRequest?>(null) }
  var passwordTarget by remember { mutableStateOf<AdminUserItem?>(null) }
  var newPassword by remember { mutableStateOf("") }
  var tokenLimitTarget by remember { mutableStateOf<AdminUserItem?>(null) }
  var tokenBindLimitInput by remember { mutableStateOf("") }
  var activationTarget by remember { mutableStateOf<AdminUserItem?>(null) }
  var resetCodePayload by remember { mutableStateOf<AdminPasswordResetCodePayload?>(null) }
  var mfaResetUrl by remember { mutableStateOf<String?>(null) }
  var userQuery by remember { mutableStateOf("") }
  var userFilter by remember { mutableStateOf("all") }
  val filteredUsers = uiState.users.filter { user ->
    val matchesQuery = userQuery.isBlank() ||
      user.username.contains(userQuery, ignoreCase = true) ||
      user.email.orEmpty().contains(userQuery, ignoreCase = true) ||
      user.id.contains(userQuery, ignoreCase = true)
    val matchesFilter = when (userFilter) {
      "admin" -> user.isAdmin
      "normal" -> !user.isAdmin
      "mfa" -> user.mfaEnabled
      else -> true
    }
    matchesQuery && matchesFilter
  }

  AdminConfirmDialog(
    currentUser = currentUser,
    request = confirmRequest,
    onDismiss = { confirmRequest = null },
    onConfirm = { credential, action ->
      scope.launch {
        when (val result = viewModel.confirmSensitiveAction(credential)) {
          is ApiResult.Success -> {
            confirmRequest = null
            action()
          }

          is ApiResult.Failure -> context.showToast(result.error.message)
        }
      }
    },
  )

  if (passwordTarget != null) {
    AlertDialog(
      onDismissRequest = { passwordTarget = null },
      title = { Text("重置密码") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Text("目标账号：${passwordTarget?.username}")
          OutlinedTextField(
            value = newPassword,
            onValueChange = { newPassword = it },
            label = { Text("新密码") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
          )
        }
      },
      confirmButton = {
        TextButton(
          onClick = {
            val target = passwordTarget ?: return@TextButton
            confirmRequest = AdminConfirmDialogRequest("重置密码") {
              val result = viewModel.resetUserPassword(target.id, newPassword.trim())
              if (context.showApiResult(result, "密码已重置")) {
                passwordTarget = null
                newPassword = ""
              }
            }
          },
        ) { Text("继续") }
      },
      dismissButton = {
        TextButton(onClick = { passwordTarget = null }) { Text("取消") }
      },
    )
  }

  if (tokenLimitTarget != null) {
    AlertDialog(
      onDismissRequest = { tokenLimitTarget = null },
      title = { Text("修改令牌上限") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Text("目标账号：${tokenLimitTarget?.username}")
          OutlinedTextField(
            value = tokenBindLimitInput,
            onValueChange = { tokenBindLimitInput = it.filter(Char::isDigit) },
            label = { Text("令牌绑定上限") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
        }
      },
      confirmButton = {
        TextButton(
          onClick = {
            val target = tokenLimitTarget ?: return@TextButton
            val nextLimit = tokenBindLimitInput.toIntOrNull()?.coerceAtLeast(1) ?: return@TextButton
            confirmRequest = AdminConfirmDialogRequest("修改令牌上限") {
              val result = viewModel.updateUserTokenBindLimit(target.id, nextLimit)
              if (context.showApiResult(result, "令牌上限已更新")) {
                tokenLimitTarget = null
                tokenBindLimitInput = ""
              }
            }
          },
        ) { Text("继续") }
      },
      dismissButton = {
        TextButton(onClick = { tokenLimitTarget = null }) { Text("取消") }
      },
    )
  }

  if (activationTarget != null) {
    AlertDialog(
      onDismissRequest = { activationTarget = null },
      title = { Text("令牌激活记录") },
      text = {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 360.dp)
            .verticalScroll(rememberScrollState()),
          verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
          val payload = uiState.tokenActivations
          Text("账号：${payload?.username ?: activationTarget?.username ?: "--"}")
          Text("总数：${payload?.total ?: 0} / 有效：${payload?.activeCount ?: 0} / 失效：${payload?.expiredCount ?: 0}")
          payload?.items?.forEach { item ->
            AdminCardSection(
              title = item.roleName ?: item.tokenId ?: "激活记录",
              subtitle = "令牌编号：${item.tokenId ?: "--"}",
            ) {
              Text("角色编号：${item.roleId ?: "--"}")
              Text("到期时间：${formatDateTime(item.expiresAt)}")
              Text("状态：${if (item.active) "有效" else "已过期"}")
            }
          }
        }
      },
      confirmButton = {
        TextButton(onClick = { activationTarget = null }) { Text("关闭") }
      },
      dismissButton = {},
    )
  }

  if (resetCodePayload != null) {
    AlertDialog(
      onDismissRequest = { resetCodePayload = null },
      title = { Text("短时重置码") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("账号：${resetCodePayload?.username}")
          Text("短验证码：${resetCodePayload?.shortCode}")
          Text("到期时间：${formatDateTime(resetCodePayload?.expiresAt)}")
        }
      },
      confirmButton = {
        TextButton(onClick = { resetCodePayload = null }) { Text("关闭") }
      },
      dismissButton = {},
    )
  }

  if (mfaResetUrl != null) {
    AlertDialog(
      onDismissRequest = { mfaResetUrl = null },
      title = { Text("多重验证重置链接") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("请尽快复制并发送给用户。")
          Text(mfaResetUrl ?: "--")
        }
      },
      confirmButton = {
        TextButton(onClick = { mfaResetUrl = null }) { Text("关闭") }
      },
      dismissButton = {},
    )
  }

  AdminScreenScaffold(
    title = "用户管理",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh() } }) {
        Text(if (uiState.isLoading) "刷新中…" else "刷新")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminCardSection(
          title = "搜索与筛选",
          subtitle = "按用户名、邮箱、用户编号、本地权限状态筛选。",
        ) {
          OutlinedTextField(
            value = userQuery,
            onValueChange = { userQuery = it },
            label = { Text("搜索用户") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
          )
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "全部", "admin" to "管理员", "normal" to "普通用户", "mfa" to "已开多重验证").forEach { (value, label) ->
              FilterChip(
                selected = userFilter == value,
                onClick = { userFilter = value },
                label = { Text(label) },
              )
            }
          }
        }
      }
      item {
        AdminStatsRow(
          stats = listOf(
            "用户总数" to filteredUsers.size.toString(),
            "管理员" to uiState.users.count { it.isAdmin }.toString(),
            "当前账号" to (currentUser?.username ?: "--"),
          ),
        )
      }
      item {
        AdminErrorBanner(uiState.error?.message)
      }
      items(filteredUsers, key = { it.id }) { user ->
        AdminCardSection(
          title = user.username,
          subtitle = listOfNotNull(
            user.email,
            if (user.isAdmin) "管理员" else "普通用户",
            if (user.isCurrentUser) "当前登录账号" else null,
          ).joinToString(" · "),
        ) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            XyzwStatusChip(status = if (user.isAdmin) "admin" else "user", label = if (user.isAdmin) "管理员" else "普通用户")
            XyzwStatusChip(status = if (user.mfaEnabled) "enabled" else "disabled", label = if (user.mfaEnabled) "多重验证已启用" else "多重验证未启用")
          }
          Text("权限范围：${accessScopeLabel(user.accessScope)}", fontWeight = FontWeight.Medium)
          Text("令牌绑定上限：${user.tokenBindLimit}")
          Text("角色数：${user.roleCount} / 邀请码数：${user.inviteCount}")
          Text("多重验证：${if (user.mfaEnabled) "已开启" else "未开启"}")
          Text("创建时间：${formatDateTime(user.createdAt)}")
          Text("最近登录：${formatDateTime(user.lastLoginAt)}")

          Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (!user.isCurrentUser) {
              OutlinedButton(
                onClick = {
                  confirmRequest = AdminConfirmDialogRequest(
                    if (user.isAdmin) "移除管理员权限" else "授予管理员权限",
                  ) {
                    val result = viewModel.updateUserAdmin(user.id, !user.isAdmin)
                    context.showApiResult(result, "管理员权限已更新")
                  }
                },
                modifier = Modifier.fillMaxWidth(),
              ) {
                Text(if (user.isAdmin) "移除管理员权限" else "授予管理员权限")
              }
            }
            OutlinedButton(
              onClick = {
                val nextScope = if (user.accessScope == "full") "task_control_only" else "full"
                confirmRequest = AdminConfirmDialogRequest("调整权限范围") {
                  val result = viewModel.updateUserAccessScope(user.id, nextScope)
                  context.showApiResult(result, "权限范围已更新")
                }
              },
              modifier = Modifier.fillMaxWidth(),
            ) {
              Text(if (user.accessScope == "full") "切到普通版" else "切到全功能")
            }
            OutlinedButton(
              onClick = {
                tokenLimitTarget = user
                tokenBindLimitInput = user.tokenBindLimit.toString()
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("修改令牌上限") }
            OutlinedButton(
              onClick = { passwordTarget = user; newPassword = "" },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("重置密码") }
            OutlinedButton(
              onClick = {
                confirmRequest = AdminConfirmDialogRequest("创建密码重置码") {
                  when (val result = viewModel.createPasswordResetCode(user.id)) {
                    is ApiResult.Success -> {
                      resetCodePayload = result.data
                      context.showToast(result.message ?: "已生成密码重置码")
                    }

                    is ApiResult.Failure -> context.showToast(result.error.message)
                  }
                }
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("创建密码重置码") }
            if (user.mfaEnabled) {
              OutlinedButton(
                onClick = {
                  confirmRequest = AdminConfirmDialogRequest("创建多重验证重置链接") {
                    when (val result = viewModel.createMfaResetLink(user.id)) {
                      is ApiResult.Success -> {
                        mfaResetUrl = result.data.resetUrl
                        context.showToast(result.message ?: "已生成多重验证重置链接")
                      }

                      is ApiResult.Failure -> context.showToast(result.error.message)
                    }
                  }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("创建多重验证重置链接") }
            }
            OutlinedButton(
              onClick = {
                confirmRequest = AdminConfirmDialogRequest("吊销会话") {
                  val result = viewModel.revokeSessions(user.id)
                  context.showApiResult(result, "会话已吊销")
                }
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("吊销会话") }
            OutlinedButton(
              onClick = {
                activationTarget = user
                scope.launch { viewModel.loadTokenActivations(user.id) }
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("查看令牌激活记录") }
            if (!user.isCurrentUser) {
              OutlinedButton(
                onClick = {
                  confirmRequest = AdminConfirmDialogRequest("删除用户") {
                    val result = viewModel.deleteUser(user.id)
                    context.showApiResult(result, "用户已删除")
                  }
                },
                modifier = Modifier.fillMaxWidth(),
              ) { Text("删除用户") }
            }
          }
        }
      }
    }
  }
}

@Composable
fun AdminInvitesScreen(
  currentUser: AuthUser?,
  viewModel: AdminInvitesViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var confirmRequest by remember { mutableStateOf<AdminConfirmDialogRequest?>(null) }
  var createCount by remember { mutableStateOf("1") }
  var bindLimit by remember { mutableStateOf("1") }
  var isTemporary by remember { mutableStateOf(false) }
  var createdCodes by remember { mutableStateOf<List<String>>(emptyList()) }

  AdminConfirmDialog(
    currentUser = currentUser,
    request = confirmRequest,
    onDismiss = { confirmRequest = null },
    onConfirm = { credential, action ->
      scope.launch {
        when (val result = viewModel.confirmSensitiveAction(credential)) {
          is ApiResult.Success -> {
            confirmRequest = null
            action()
          }

          is ApiResult.Failure -> context.showToast(result.error.message)
        }
      }
    },
  )

  if (createdCodes.isNotEmpty()) {
    AlertDialog(
      onDismissRequest = { createdCodes = emptyList() },
      title = { Text("新创建的邀请码") },
      text = {
        Column(
          modifier = Modifier.verticalScroll(rememberScrollState()),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text("完整邀请码只会展示一次。")
          createdCodes.forEach { code -> Text(code) }
        }
      },
      confirmButton = {
        TextButton(onClick = { createdCodes = emptyList() }) { Text("关闭") }
      },
      dismissButton = {},
    )
  }

  AdminScreenScaffold(
    title = "邀请码",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh() } }) { Text("刷新") }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminCardSection(
          title = "创建邀请码",
          subtitle = "支持数量、临时类型和绑定上限。",
        ) {
          OutlinedTextField(
            value = createCount,
            onValueChange = { createCount = it.filter(Char::isDigit) },
            label = { Text("生成数量") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = bindLimit,
            onValueChange = { bindLimit = it.filter(Char::isDigit) },
            label = { Text("绑定账号上限") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
              selected = !isTemporary,
              onClick = { isTemporary = false },
              label = { Text("普通邀请码") },
            )
            FilterChip(
              selected = isTemporary,
              onClick = { isTemporary = true },
              label = { Text("临时邀请码") },
            )
          }
          Button(
            onClick = {
              val count = max(1, createCount.toIntOrNull() ?: 1)
              val limit = max(1, bindLimit.toIntOrNull() ?: 1)
              confirmRequest = AdminConfirmDialogRequest("创建邀请码") {
                when (
                  val result = viewModel.createInvites(
                    count = count,
                    isTemporary = isTemporary,
                    bindAccountLimit = limit,
                  )
                ) {
                  is ApiResult.Success -> {
                    createdCodes = result.data.mapNotNull { it.code ?: it.maskedCode ?: it.codeMask }
                    context.showToast(result.message ?: "邀请码已创建")
                  }

                  is ApiResult.Failure -> context.showToast(result.error.message)
                }
              }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("创建邀请码") }
        }
      }
      item {
        AdminStatsRow(
          stats = listOf(
            "总数" to uiState.invites.size.toString(),
            "可用" to uiState.invites.count { it.isActive && it.usedAt.isNullOrBlank() }.toString(),
            "已使用" to uiState.invites.count { !it.usedAt.isNullOrBlank() }.toString(),
          ),
        )
      }
      item { AdminErrorBanner(uiState.error?.message) }
      items(uiState.invites, key = { it.id }) { invite ->
        AdminCardSection(
          title = invite.code ?: invite.maskedCode ?: invite.codeMask ?: invite.id,
          subtitle = inviteStatusLabel(invite),
        ) {
          Text("类型：${if (invite.isTemporary) "临时邀请码" else "普通邀请码"}")
          Text("绑定账号上限：${invite.bindAccountLimit}")
          Text("创建者：${invite.createdBy ?: "--"}")
          Text("使用者：${invite.usedBy ?: "--"}")
          Text("创建时间：${formatDateTime(invite.createdAt)}")
          Text("自动停用时间：${formatDateTime(invite.autoDisableAt)}")
          OutlinedButton(
            onClick = {
              confirmRequest = AdminConfirmDialogRequest("查看邀请码明码") {
                val result = viewModel.revealInvite(invite.id)
                context.showApiResult(result, "邀请码明码只在创建时显示")
              }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("查看明码") }
          if (invite.isActive && invite.usedAt.isNullOrBlank()) {
            OutlinedButton(
              onClick = {
                confirmRequest = AdminConfirmDialogRequest("禁用邀请码") {
                  val result = viewModel.disableInvite(invite.id)
                  context.showApiResult(result, "邀请码已禁用")
                }
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("禁用邀请码") }
          }
        }
      }
    }
  }
}

@Composable
fun AdminActivationCodesScreen(
  currentUser: AuthUser?,
  viewModel: AdminActivationCodesViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var confirmRequest by remember { mutableStateOf<AdminConfirmDialogRequest?>(null) }
  var createCount by remember { mutableStateOf("1") }
  var durationMonths by remember { mutableStateOf(1) }
  var featureScope by remember { mutableStateOf("full") }
  var saleAmountYuan by remember { mutableStateOf("30") }
  var createdCodes by remember { mutableStateOf<List<String>>(emptyList()) }

  AdminConfirmDialog(
    currentUser = currentUser,
    request = confirmRequest,
    onDismiss = { confirmRequest = null },
    onConfirm = { credential, action ->
      scope.launch {
        when (val result = viewModel.confirmSensitiveAction(credential)) {
          is ApiResult.Success -> {
            confirmRequest = null
            action()
          }

          is ApiResult.Failure -> context.showToast(result.error.message)
        }
      }
    },
  )

  if (createdCodes.isNotEmpty()) {
    AlertDialog(
      onDismissRequest = { createdCodes = emptyList() },
      title = { Text("新创建的激活码") },
      text = {
        Column(
          modifier = Modifier.verticalScroll(rememberScrollState()),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text("完整激活码只会展示一次。")
          createdCodes.forEach { code -> Text(code) }
        }
      },
      confirmButton = {
        TextButton(onClick = { createdCodes = emptyList() }) { Text("关闭") }
      },
      dismissButton = {},
    )
  }

  AdminScreenScaffold(
    title = "激活码",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh() } }) { Text("刷新") }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminCardSection(
          title = "创建激活码",
          subtitle = "支持时长、版本类型、售价和批量生成。",
        ) {
          OutlinedTextField(
            value = createCount,
            onValueChange = { createCount = it.filter(Char::isDigit) },
            label = { Text("生成数量") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(0 to "1天", 1 to "1月", 3 to "1季", 6 to "半年", 12 to "1年").forEach { (value, label) ->
              FilterChip(
                selected = durationMonths == value,
                onClick = { durationMonths = value },
                label = { Text(label) },
              )
            }
          }
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
              selected = featureScope == "full",
              onClick = { featureScope = "full" },
              label = { Text("全功能") },
            )
            FilterChip(
              selected = featureScope == "task_control_only",
              onClick = { featureScope = "task_control_only" },
              label = { Text("普通版") },
            )
          }
          OutlinedTextField(
            value = saleAmountYuan,
            onValueChange = { saleAmountYuan = it.filter { c -> c.isDigit() } },
            label = { Text("售价（元）") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
            enabled = durationMonths != 0,
          )
          Button(
            onClick = {
              val count = max(1, createCount.toIntOrNull() ?: 1)
              val saleAmountCents = if (durationMonths == 0) 0 else (saleAmountYuan.toIntOrNull() ?: 0) * 100
              confirmRequest = AdminConfirmDialogRequest("创建激活码") {
                when (
                  val result = viewModel.createActivationCodes(
                    count = count,
                    featureScope = featureScope,
                    durationMonths = durationMonths,
                    saleAmountCents = saleAmountCents,
                  )
                ) {
                  is ApiResult.Success -> {
                    createdCodes = result.data.mapNotNull { it.code ?: it.maskedCode ?: it.codeMask }
                    context.showToast(result.message ?: "激活码已创建")
                  }

                  is ApiResult.Failure -> context.showToast(result.error.message)
                }
              }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("创建激活码") }
          OutlinedButton(
            onClick = {
              confirmRequest = AdminConfirmDialogRequest("全部解绑") {
                val result = viewModel.unbindAllActivationCodes()
                context.showApiResult(result, "全部绑定已清空")
              }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("全部解绑") }
        }
      }
      item {
        AdminStatsRow(
          stats = listOf(
            "总数" to uiState.activationCodes.size.toString(),
            "可用" to uiState.activationCodes.count { it.isActive && it.usedAt.isNullOrBlank() }.toString(),
            "已绑定" to uiState.activationCodes.count { it.bindingActive || !it.bindingRoleName.isNullOrBlank() }.toString(),
          ),
        )
      }
      item { AdminErrorBanner(uiState.error?.message) }
      items(uiState.activationCodes, key = { it.id }) { code ->
        AdminCardSection(
          title = code.code ?: code.maskedCode ?: code.codeMask ?: code.id,
          subtitle = activationStatusLabel(code),
        ) {
          Text("版本类型：${featureScopeLabel(code.featureScope)}")
          Text("时长：${durationLabel(code.durationMonths)}")
          Text("售价：${formatMoney(code.saleAmountCents, code.saleCurrency)}")
          Text("绑定角色：${code.bindingRoleName ?: "--"}")
          Text("绑定用户：${code.bindingUsername ?: "--"}")
          Text("到期时间：${formatDateTime(code.bindingExpiresAt)}")
          Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (code.bindingActive || !code.bindingRoleName.isNullOrBlank()) {
              OutlinedButton(
                onClick = {
                  confirmRequest = AdminConfirmDialogRequest("解绑激活码") {
                    val result = viewModel.unbindActivationCode(code.id)
                    context.showApiResult(result, "激活码已解绑")
                  }
                },
                modifier = Modifier.fillMaxWidth(),
              ) { Text("解绑") }
            }
            if (code.isActive && code.usedAt.isNullOrBlank()) {
              OutlinedButton(
                onClick = {
                  confirmRequest = AdminConfirmDialogRequest("禁用激活码") {
                    val result = viewModel.disableActivationCode(code.id)
                    context.showApiResult(result, "激活码已禁用")
                  }
                },
                modifier = Modifier.fillMaxWidth(),
              ) { Text("禁用") }
            }
            OutlinedButton(
              onClick = {
                confirmRequest = AdminConfirmDialogRequest("删除激活码") {
                  val result = viewModel.deleteActivationCode(code.id)
                  context.showApiResult(result, "激活码已删除")
                }
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("删除") }
            OutlinedButton(
              onClick = {
                confirmRequest = AdminConfirmDialogRequest("查看激活码明码") {
                  val result = viewModel.revealActivationCode(code.id)
                  context.showApiResult(result, "激活码明码只在创建时显示")
                }
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("查看明码") }
          }
        }
      }
    }
  }
}

@Composable
fun AdminFeedbackTicketsScreen(
  currentUser: AuthUser?,
  viewModel: AdminFeedbackTicketsViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  val statusDrafts = remember { mutableStateMapOf<String, String>() }
  val noteDrafts = remember { mutableStateMapOf<String, String>() }
  var statusFilter by remember { mutableStateOf("") }

  LaunchedEffect(uiState.feedbacks) {
    uiState.feedbacks.forEach { item ->
      statusDrafts[item.id] = item.status
      noteDrafts[item.id] = item.adminNote.orEmpty()
    }
  }

  AdminScreenScaffold(
    title = "工单管理",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh(statusFilter) } }) { Text("刷新") }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminCardSection(
          title = "状态筛选",
          subtitle = "切换状态后立即刷新列表。",
        ) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("" to "全部", "open" to "待处理", "in_progress" to "处理中", "resolved" to "已完成").forEach { (value, label) ->
              FilterChip(
                selected = statusFilter == value,
                onClick = {
                  statusFilter = value
                  scope.launch { viewModel.refresh(statusFilter) }
                },
                label = { Text(label) },
              )
            }
          }
        }
      }
      item {
        AdminStatsRow(
          stats = listOf(
            "总数" to uiState.feedbacks.size.toString(),
            "待处理" to uiState.feedbacks.count { it.status == "open" }.toString(),
            "处理中" to uiState.feedbacks.count { it.status == "in_progress" }.toString(),
            "已完成" to uiState.feedbacks.count { it.status == "resolved" }.toString(),
          ),
        )
      }
      item { AdminErrorBanner(uiState.error?.message) }
      items(uiState.feedbacks, key = { it.id }) { ticket ->
        AdminCardSection(
          title = ticket.title,
          subtitle = "${feedbackTypeLabel(ticket.type)} · ${ticket.username ?: "--"} · ${formatDateTime(ticket.createdAt)}",
        ) {
          XyzwExpandableText(ticket.content)
          XyzwStatusChip(status = ticket.status, label = statusLabel(ticket.status))
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("open" to "待处理", "in_progress" to "处理中", "resolved" to "已完成").forEach { (value, label) ->
              FilterChip(
                selected = statusDrafts[ticket.id] == value,
                onClick = { statusDrafts[ticket.id] = value },
                label = { Text(label) },
              )
            }
          }
          OutlinedTextField(
            value = noteDrafts[ticket.id].orEmpty(),
            onValueChange = { noteDrafts[ticket.id] = it },
            label = { Text("管理员备注") },
            modifier = Modifier.fillMaxWidth(),
          )
          Button(
            onClick = {
              scope.launch {
                val result = viewModel.updateTicket(
                  id = ticket.id,
                  status = statusDrafts[ticket.id] ?: ticket.status,
                  adminNote = noteDrafts[ticket.id].orEmpty(),
                )
                context.showApiResult(result, "工单已更新")
              }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("保存") }
        }
      }
    }
  }
}

@Composable
fun AdminTaskControlLogsScreen(
  currentUser: AuthUser?,
  viewModel: AdminTaskControlLogsViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  var filters by remember { mutableStateOf(uiState.filters) }

  AdminScreenScaffold(
    title = "后端任务日志",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh(filters) } }) {
        Text(if (uiState.isLoading) "刷新中…" else "刷新")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminCardSection(
          title = "筛选",
          subtitle = "支持用户名、任务名、状态、任务编号、消息和数量筛选。",
        ) {
          OutlinedTextField(
            value = filters.username,
            onValueChange = { filters = filters.copy(username = it) },
            label = { Text("用户名") },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = filters.taskName,
            onValueChange = { filters = filters.copy(taskName = it) },
            label = { Text("任务名") },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = filters.status,
            onValueChange = { filters = filters.copy(status = it) },
            label = { Text("状态") },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = filters.taskId,
            onValueChange = { filters = filters.copy(taskId = it) },
            label = { Text("任务编号") },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = filters.message,
            onValueChange = { filters = filters.copy(message = it) },
            label = { Text("消息") },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = filters.limit.toString(),
            onValueChange = {
              filters = filters.copy(limit = it.filter(Char::isDigit).toIntOrNull() ?: filters.limit)
            },
            label = { Text("数量上限") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedButton(
            onClick = {
              filters = AdminTaskControlLogFilters()
              scope.launch { viewModel.refresh(filters) }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("重置筛选") }
        }
      }
      item {
        AdminStatsRow(
          stats = listOf(
            "日志数" to uiState.logs.size.toString(),
            "数量上限" to filters.limit.toString(),
          ),
        )
      }
      item { AdminErrorBanner(uiState.error?.message) }
      items(uiState.logs, key = { it.id }) { log ->
        AdminCardSection(
          title = log.taskName ?: log.taskId ?: "任务日志",
          subtitle = "${log.username ?: log.userId ?: "--"} · ${statusLabel(log.status)} · ${formatDateTime(log.createdAt)}",
        ) {
          Text("任务编号：${log.taskId ?: "--"}")
          XyzwExpandableText(log.message)
        }
      }
    }
  }
}

@Composable
fun AdminChangelogBroadcastScreen(
  currentUser: AuthUser?,
  viewModel: AdminChangelogBroadcastViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var version by remember { mutableStateOf("") }
  var title by remember { mutableStateOf("") }
  var content by remember { mutableStateOf("") }

  AdminScreenScaffold(
    title = "更新日志广播",
    onBack = onBack,
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp)
        .verticalScroll(rememberScrollState()),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      AdminStatsRow(
        stats = listOf(
          "版本号" to if (version.isBlank()) "--" else version,
          "目标路径" to "/changelog",
        ),
      )
      AdminErrorBanner(uiState.error?.message)
      AdminCardSection(
        title = "广播内容",
        subtitle = "发送后会向全部账户下发站内通知。",
      ) {
        OutlinedTextField(
          value = version,
          onValueChange = { version = it },
          label = { Text("版本号") },
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          value = title,
          onValueChange = { title = it },
          label = { Text("标题") },
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          value = content,
          onValueChange = { content = it },
          label = { Text("内容") },
          modifier = Modifier.fillMaxWidth(),
          minLines = 4,
        )
        Button(
          onClick = {
            scope.launch {
              val result = viewModel.send(
                version = version.trim(),
                title = title.trim(),
                content = content.trim(),
              )
              context.showApiResult(result, "更新日志广播已发送")
            }
          },
          modifier = Modifier.fillMaxWidth(),
          enabled = !uiState.isSending,
        ) {
          Text(if (uiState.isSending) "发送中…" else "发送广播")
        }
      }
      AdminCardSection(
        title = "发送预览",
        subtitle = "用户点击通知后会进入更新日志页面。",
      ) {
        Text("标题：${if (title.isBlank()) "更新日志 ${version.ifBlank { "--" }}" else title}")
        Text("内容：${if (content.isBlank()) "已发布 ${version.ifBlank { "新版本" }}，点击查看详情" else content}")
      }
    }
  }
}

@Composable
fun AdminWechatContactsScreen(
  currentUser: AuthUser?,
  viewModel: AdminWechatContactsViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var confirmRequest by remember { mutableStateOf<AdminConfirmDialogRequest?>(null) }
  var editingContact by remember { mutableStateOf<WechatContactAdminItem?>(null) }
  var showEditor by remember { mutableStateOf(false) }
  var slug by remember { mutableStateOf("") }
  var title by remember { mutableStateOf("") }
  var subtitle by remember { mutableStateOf("") }
  var contactType by remember { mutableStateOf("landing_qr") }
  var targetUrl by remember { mutableStateOf("") }
  var wechatId by remember { mutableStateOf("") }
  var qrImageDataUrl by remember { mutableStateOf("") }
  var showInPricing by remember { mutableStateOf(true) }
  var isActive by remember { mutableStateOf(true) }
  var sortOrder by remember { mutableStateOf("100") }

  fun openEditor(contact: WechatContactAdminItem?) {
    editingContact = contact
    slug = contact?.slug ?: ""
    title = contact?.title ?: ""
    subtitle = contact?.subtitle ?: ""
    contactType = contact?.contactType ?: "landing_qr"
    targetUrl = contact?.targetUrl ?: ""
    wechatId = contact?.wechatId ?: ""
    qrImageDataUrl = contact?.qrImageDataUrl ?: ""
    showInPricing = contact?.showInPricing ?: true
    isActive = contact?.isActive ?: true
    sortOrder = (contact?.sortOrder ?: 100).toString()
    showEditor = true
  }

  AdminConfirmDialog(
    currentUser = currentUser,
    request = confirmRequest,
    onDismiss = { confirmRequest = null },
    onConfirm = { credential, action ->
      scope.launch {
        when (val result = viewModel.confirmSensitiveAction(credential)) {
          is ApiResult.Success -> {
            confirmRequest = null
            action()
          }

          is ApiResult.Failure -> context.showToast(result.error.message)
        }
      }
    },
  )

  if (showEditor) {
    AlertDialog(
      onDismissRequest = { showEditor = false },
      title = { Text(if (editingContact == null) "新增微信联系人" else "编辑微信联系人") },
      text = {
        Column(
          modifier = Modifier.verticalScroll(rememberScrollState()),
          verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
          OutlinedTextField(value = slug, onValueChange = { slug = it.trim() }, label = { Text("短链接标识") }, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("标题") }, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = subtitle, onValueChange = { subtitle = it }, label = { Text("副标题") }, modifier = Modifier.fillMaxWidth())
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("landing_qr" to "二维码页", "wecom_kf_link" to "企微客服", "external_url" to "外链").forEach { (value, label) ->
              FilterChip(selected = contactType == value, onClick = { contactType = value }, label = { Text(label) })
            }
          }
          if (contactType == "landing_qr") {
            OutlinedTextField(value = wechatId, onValueChange = { wechatId = it }, label = { Text("微信号") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
              value = qrImageDataUrl,
              onValueChange = { qrImageDataUrl = it },
              label = { Text("二维码图片数据") },
              modifier = Modifier.fillMaxWidth(),
              minLines = 4,
            )
          } else {
            OutlinedTextField(value = targetUrl, onValueChange = { targetUrl = it }, label = { Text("目标链接") }, modifier = Modifier.fillMaxWidth())
          }
          OutlinedTextField(
            value = sortOrder,
            onValueChange = { sortOrder = it.filter(Char::isDigit) },
            label = { Text("排序值") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = showInPricing, onClick = { showInPricing = !showInPricing }, label = { Text(if (showInPricing) "价格菜单可见" else "价格菜单隐藏") })
            FilterChip(selected = isActive, onClick = { isActive = !isActive }, label = { Text(if (isActive) "已启用" else "已停用") })
          }
        }
      },
      confirmButton = {
        TextButton(
          onClick = {
            val request = AdminWechatContactRequest(
              slug = slug.trim(),
              title = title.trim(),
              subtitle = subtitle.trim(),
              contactType = contactType,
              targetUrl = targetUrl.trim(),
              wechatId = wechatId.trim(),
              qrImageDataUrl = qrImageDataUrl.trim(),
              showInPricing = showInPricing,
              isActive = isActive,
              sortOrder = max(0, sortOrder.toIntOrNull() ?: 100),
            )
            confirmRequest = AdminConfirmDialogRequest(if (editingContact == null) "创建微信联系人" else "更新微信联系人") {
              val result = if (editingContact == null) {
                viewModel.createContact(request)
              } else {
                viewModel.updateContact(editingContact!!.id, request)
              }
              if (context.showApiResult(result, if (editingContact == null) "微信联系人已创建" else "微信联系人已更新")) {
                showEditor = false
              }
            }
          },
        ) { Text("继续") }
      },
      dismissButton = {
        TextButton(onClick = { showEditor = false }) { Text("取消") }
      },
    )
  }

  AdminScreenScaffold(
    title = "微信联系配置",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh() } }) { Text("刷新") }
      TextButton(onClick = { openEditor(null) }) { Text("新增") }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminStatsRow(
          stats = listOf(
            "总数" to uiState.contacts.size.toString(),
            "启用中" to uiState.contacts.count { it.isActive }.toString(),
            "价格菜单可见" to uiState.contacts.count { it.isActive && it.showInPricing }.toString(),
          ),
        )
      }
      item { AdminErrorBanner(uiState.error?.message) }
      items(uiState.contacts, key = { it.id }) { contact ->
        AdminCardSection(
          title = contact.title,
          subtitle = "${contact.slug} · ${contactTypeLabel(contact.contactType)}",
        ) {
          Text("副标题：${contact.subtitle ?: "--"}")
          Text("目标链接：${contact.targetUrl ?: "--"}")
          Text("微信号：${contact.wechatId ?: "--"}")
          Text("排序值：${contact.sortOrder}")
          Text("价格菜单：${if (contact.showInPricing) "显示" else "隐藏"} / ${if (contact.isActive) "启用" else "停用"}")
          OutlinedButton(
            onClick = { openEditor(contact) },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("编辑") }
          OutlinedButton(
            onClick = {
              confirmRequest = AdminConfirmDialogRequest("删除微信联系人") {
                val result = viewModel.deleteContact(contact.id)
                context.showApiResult(result, "微信联系人已删除")
              }
            },
            modifier = Modifier.fillMaxWidth(),
          ) { Text("删除") }
        }
      }
    }
  }
}

@Composable
fun AdminReferralsScreen(
  currentUser: AuthUser?,
  viewModel: AdminReferralsViewModel,
  onBack: () -> Unit,
) {
  if (!buildAdminEntrySpec(currentUser).showEntry) {
    AdminAccessDeniedScreen(onBack = onBack)
    return
  }
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var confirmRequest by remember { mutableStateOf<AdminConfirmDialogRequest?>(null) }
  var markPaidTarget by remember { mutableStateOf<ReferralConversionItem?>(null) }
  var markPaidChannel by remember { mutableStateOf("wechat_manual") }
  var markPaidSettlementRef by remember { mutableStateOf("") }
  var markPaidNote by remember { mutableStateOf("") }
  var rejectTarget by remember { mutableStateOf<ReferralConversionItem?>(null) }
  var rejectNote by remember { mutableStateOf("") }

  AdminConfirmDialog(
    currentUser = currentUser,
    request = confirmRequest,
    onDismiss = { confirmRequest = null },
    onConfirm = { credential, action ->
      scope.launch {
        when (val result = viewModel.confirmSensitiveAction(credential)) {
          is ApiResult.Success -> {
            confirmRequest = null
            action()
          }

          is ApiResult.Failure -> context.showToast(result.error.message)
        }
      }
    },
  )

  if (markPaidTarget != null) {
    AlertDialog(
      onDismissRequest = { markPaidTarget = null },
      title = { Text("标记已支付") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("返佣对象：${markPaidTarget?.referredUsername ?: "--"}")
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("wechat_manual" to "微信手工", "bank" to "银行", "other" to "其他").forEach { (value, label) ->
              FilterChip(selected = markPaidChannel == value, onClick = { markPaidChannel = value }, label = { Text(label) })
            }
          }
          OutlinedTextField(
            value = markPaidSettlementRef,
            onValueChange = { markPaidSettlementRef = it },
            label = { Text("结算单号") },
            modifier = Modifier.fillMaxWidth(),
          )
          OutlinedTextField(
            value = markPaidNote,
            onValueChange = { markPaidNote = it },
            label = { Text("备注") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
          )
        }
      },
      confirmButton = {
        TextButton(
          onClick = {
            val target = markPaidTarget ?: return@TextButton
            confirmRequest = AdminConfirmDialogRequest("标记已支付") {
              val result = viewModel.markPaid(
                id = target.id,
                channel = markPaidChannel,
                settlementRef = markPaidSettlementRef.trim(),
                note = markPaidNote.trim(),
              )
              if (context.showApiResult(result, "返佣已标记为已支付")) {
                markPaidTarget = null
              }
            }
          },
        ) { Text("继续") }
      },
      dismissButton = {
        TextButton(onClick = { markPaidTarget = null }) { Text("取消") }
      },
    )
  }

  if (rejectTarget != null) {
    AlertDialog(
      onDismissRequest = { rejectTarget = null },
      title = { Text("驳回返佣") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("返佣对象：${rejectTarget?.referredUsername ?: "--"}")
          OutlinedTextField(
            value = rejectNote,
            onValueChange = { rejectNote = it },
            label = { Text("驳回原因") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
          )
        }
      },
      confirmButton = {
        TextButton(
          onClick = {
            val target = rejectTarget ?: return@TextButton
            confirmRequest = AdminConfirmDialogRequest("驳回返佣") {
              val result = viewModel.reject(target.id, rejectNote.trim())
              if (context.showApiResult(result, "返佣已驳回")) {
                rejectTarget = null
              }
            }
          },
        ) { Text("继续") }
      },
      dismissButton = {
        TextButton(onClick = { rejectTarget = null }) { Text("取消") }
      },
    )
  }

  AdminScreenScaffold(
    title = "推广归因",
    onBack = onBack,
    actions = {
      TextButton(onClick = { scope.launch { viewModel.refresh() } }) { Text("刷新") }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        AdminStatsRow(
          stats = listOf(
            "归因记录" to uiState.attributions.size.toString(),
            "转化记录" to uiState.conversions.size.toString(),
            "待结算" to uiState.conversions.count { it.rewardStatus == "pending" }.toString(),
            "已支付" to uiState.conversions.count { it.rewardStatus == "paid" }.toString(),
          ),
        )
      }
      item { AdminErrorBanner(uiState.error?.message) }
      item {
        AdminCardSection(
          title = "归因记录",
          subtitle = "注册归因与邀请码快照。",
        ) {
          Text("当前共 ${uiState.attributions.size} 条")
        }
      }
      items(uiState.attributions, key = { "attr-${it.id}" }) { attribution ->
        AdminCardSection(
          title = "${attribution.referrerUsername} 到 ${attribution.referredUsername}",
          subtitle = formatDateTime(attribution.registeredAt),
        ) {
          Text("推广码：${attribution.referralCodeSnapshot}")
          Text("邀请码：${attribution.inviteCodeMask ?: "--"}")
          Text("注册地址：${attribution.registerIp ?: "--"}")
        }
      }
      item {
        AdminCardSection(
          title = "转化记录",
          subtitle = "标记已支付或驳回。",
        ) {
          Text("当前共 ${uiState.conversions.size} 条")
        }
      }
      items(uiState.conversions, key = { "conv-${it.id}" }) { conversion ->
        AdminCardSection(
          title = "${conversion.referrerUsername} 到 ${conversion.referredUsername}",
          subtitle = "${rewardStatusLabel(conversion.rewardStatus)} · ${formatMoney(conversion.rewardAmountCents)}",
        ) {
          Text("激活码：${conversion.activationCodeMask ?: "--"}")
          Text("版本范围：${featureScopeLabel(conversion.featureScope)} / ${durationLabel(conversion.durationMonths)}")
          Text("结算渠道：${settlementChannelLabel(conversion.settlementChannel)}")
          Text("结算单号：${conversion.settlementRef ?: "--"}")
          XyzwExpandableText("备注：${conversion.note ?: "--"}")
          if (conversion.rewardStatus == "pending") {
            OutlinedButton(
              onClick = {
                markPaidTarget = conversion
                markPaidChannel = "wechat_manual"
                markPaidSettlementRef = ""
                markPaidNote = conversion.note.orEmpty()
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("标记已支付") }
            OutlinedButton(
              onClick = {
                rejectTarget = conversion
                rejectNote = conversion.note.orEmpty()
              },
              modifier = Modifier.fillMaxWidth(),
            ) { Text("驳回") }
          }
        }
      }
    }
  }
}

private fun formatDateTime(value: String?): String =
  formatDisplayDateTime(value)

private fun featureScopeLabel(value: String?): String =
  if (value == "task_control_only") "普通版" else "全功能"

private fun accessScopeLabel(value: String?): String =
  when (value) {
    "task_control_only" -> "普通版"
    "full" -> "全功能"
    else -> value?.takeIf { it.isNotBlank() } ?: "--"
  }

private fun statusLabel(value: String?): String =
  when (value) {
    "open" -> "待处理"
    "in_progress" -> "处理中"
    "resolved" -> "已完成"
    "success" -> "成功"
    "failed" -> "失败"
    "running" -> "运行中"
    "info" -> "信息"
    else -> value?.takeIf { it.isNotBlank() } ?: "--"
  }

private fun rewardStatusLabel(value: String?): String =
  when (value) {
    "pending" -> "待结算"
    "paid" -> "已支付"
    "rejected" -> "已驳回"
    else -> value?.takeIf { it.isNotBlank() } ?: "--"
  }

private fun feedbackTypeLabel(value: String?): String =
  when (value) {
    "bug" -> "问题反馈"
    "feature" -> "功能建议"
    "contact" -> "联系请求"
    else -> value?.takeIf { it.isNotBlank() } ?: "--"
  }

private fun contactTypeLabel(value: String?): String =
  when (value) {
    "wechat" -> "微信"
    "url" -> "链接"
    "qr" -> "二维码"
    else -> value?.takeIf { it.isNotBlank() } ?: "--"
  }

private fun settlementChannelLabel(value: String?): String =
  when (value) {
    "wechat_manual" -> "微信手动结算"
    "alipay_manual" -> "支付宝手动结算"
    "bank_manual" -> "银行手动结算"
    else -> value?.takeIf { it.isNotBlank() } ?: "--"
  }

private fun durationLabel(months: Int): String =
  when (months) {
    0 -> "1天"
    1 -> "1个月"
    3 -> "3个月"
    6 -> "6个月"
    12 -> "12个月"
    else -> "${months}个月"
  }

private fun formatMoney(amountCents: Int, currency: String = "CNY"): String =
  "${amountCents / 100}${if (currency == "CNY") "元" else currency}"

private fun inviteStatusLabel(invite: InviteCodeItem): String =
  when {
    !invite.usedAt.isNullOrBlank() -> "已使用"
    !invite.isActive -> "已禁用"
    else -> "可用"
  }

private fun activationStatusLabel(item: ActivationCodeItem): String =
  when {
    item.bindingActive -> "已绑定"
    !item.usedAt.isNullOrBlank() -> "已使用"
    !item.isActive -> "已禁用"
    else -> "可用"
  }
