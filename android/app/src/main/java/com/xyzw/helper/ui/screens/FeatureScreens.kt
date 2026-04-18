@file:OptIn(
  androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
  androidx.compose.material3.ExperimentalMaterial3Api::class,
)

package com.xyzw.helper.ui.screens

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.xyzw.helper.data.model.DailyTaskEntry
import com.xyzw.helper.data.model.GameRole
import com.xyzw.helper.data.model.ImportedGameToken
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.data.network.GameRoleUpsertRequest
import com.xyzw.helper.data.storage.AppPreferences
import com.xyzw.helper.data.storage.ThemeMode
import kotlinx.coroutines.launch
import java.io.IOException

@Composable
fun WorkspaceHubScreen(
  tokenCount: Int,
  roleCount: Int,
  onOpenTokens: () -> Unit,
  onOpenRoles: () -> Unit,
) {
  HubScaffold(title = "工作台") {
    HubSummaryCards(
      cards = listOf(
        "已导入 Token" to tokenCount.toString(),
        "角色数量" to roleCount.toString(),
      ),
    )
    HubEntryCard(
      title = "Token 管理",
      description = "手动导入、URL 导入、BIN 文件上传下载与删除，都在这一页完成。",
      action = "进入 Token 管理",
      onClick = onOpenTokens,
    )
    HubEntryCard(
      title = "角色管理",
      description = "查看角色、创建、编辑、删除和详情查询统一收口。",
      action = "进入角色管理",
      onClick = onOpenRoles,
    )
  }
}

@Composable
fun OpsHubScreen(
  onOpenDailyTasks: () -> Unit,
  onOpenTaskControl: () -> Unit,
) {
  HubScaffold(title = "任务") {
    HubEntryCard(
      title = "日常任务",
      description = "按角色查看任务状态、执行一次、调整启用与自动执行设置，并查看历史记录。",
      action = "进入日常任务",
      onClick = onOpenDailyTasks,
    )
    HubEntryCard(
      title = "任务控制",
      description = "查看任务控制状态、日志、刷新结果，并清空本地展示或服务端日志。",
      action = "进入任务控制",
      onClick = onOpenTaskControl,
    )
  }
}

@Composable
fun TokenManagementScreen(
  viewModel: TokenManagementViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val snackbarHostState = remember { SnackbarHostState() }
  var manualToken by rememberSaveable { mutableStateOf("") }
  var importUrl by rememberSaveable { mutableStateOf("") }
  var uploadTargetTokenId by rememberSaveable { mutableStateOf<String?>(null) }
  var confirmDownloadTokenId by rememberSaveable { mutableStateOf<String?>(null) }

  val openDocumentLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenDocument(),
  ) { uri ->
    val tokenId = uploadTargetTokenId
    uploadTargetTokenId = null
    if (uri == null || tokenId == null) return@rememberLauncherForActivityResult
    val bytes = runCatching {
      context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
    }.getOrNull()
    if (bytes == null || bytes.isEmpty()) {
      scope.launch { snackbarHostState.showSnackbar("BIN 文件读取失败") }
      return@rememberLauncherForActivityResult
    }
    viewModel.uploadBinFile(tokenId, bytes)
  }

  val createDocumentLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.CreateDocument("application/octet-stream"),
  ) { uri ->
    if (uri == null) {
      viewModel.cancelPendingDownload()
      return@rememberLauncherForActivityResult
    }
    writePendingDownload(context, uri, viewModel, snackbarHostState)
  }

  LaunchedEffect(uiState.pendingDownload?.tokenId) {
    val pending = uiState.pendingDownload ?: return@LaunchedEffect
    createDocumentLauncher.launch("${pending.tokenId}.bin")
  }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }

  DetailScaffold(
    title = "Token 管理",
    onBack = onBack,
    snackbarHostState = snackbarHostState,
    actions = {
      IconButton(onClick = viewModel::refresh) {
        Icon(Icons.Outlined.Refresh, contentDescription = "刷新")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item {
        SectionCard(
          title = "手动导入",
          description = "粘贴完整 token 文本并保存到本地加密工作区。",
        ) {
          OutlinedTextField(
            value = manualToken,
            onValueChange = { manualToken = it },
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
            label = { Text("Token") },
          )
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
              onClick = { viewModel.importManual(manualToken) },
              enabled = manualToken.isNotBlank() && !uiState.isImporting,
            ) {
              Text(if (uiState.isImporting) "导入中…" else "导入 Token")
            }
            OutlinedButton(onClick = { manualToken = "" }) {
              Text("清空")
            }
          }
        }
      }

      item {
        SectionCard(
          title = "URL 导入",
          description = "通过受信任 URL 和后端 proxy 拉取 JSON，再解析出可用 token。",
        ) {
          OutlinedTextField(
            value = importUrl,
            onValueChange = { importUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("受信任 URL") },
          )
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
              onClick = { viewModel.importFromUrl(importUrl) },
              enabled = importUrl.isNotBlank() && !uiState.isImporting,
            ) {
              Text(if (uiState.isImporting) "拉取中…" else "URL 导入")
            }
            OutlinedButton(onClick = { importUrl = "" }) {
              Text("清空")
            }
          }
        }
      }

      item {
        SectionCard(
          title = "已导入 Token",
          description = "每个 token 都会显示激活状态和 BIN 关联状态。",
        ) {
          if (uiState.tokens.isEmpty()) {
            EmptyHint("当前还没有导入 Token。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
              uiState.tokens.forEach { token ->
                TokenCard(
                  token = token,
                  onRefresh = { viewModel.refreshActivation(token.id) },
                  onUpload = {
                    uploadTargetTokenId = token.id
                    openDocumentLauncher.launch(arrayOf("*/*"))
                  },
                  onDownload = { confirmDownloadTokenId = token.id },
                  onDelete = { viewModel.removeToken(token.id) },
                  onDeleteBin = { viewModel.deleteBinFile(token.id) },
                )
              }
            }
          }
        }
      }

      item {
        SectionCard(
          title = "BIN 文件",
          description = "服务端已保存的 BIN 文件清单。",
        ) {
          if (uiState.binFiles.isEmpty()) {
            EmptyHint("没有找到已上传的 BIN 文件。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.binFiles.forEach { item ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                  ) {
                    Text(item.fileName, fontWeight = FontWeight.SemiBold)
                    Text("Token ID: ${item.tokenId}")
                    Text("大小: ${item.size} bytes")
                    Text("更新时间: ${item.updatedAt}")
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (confirmDownloadTokenId != null) {
    SensitiveConfirmDialog(
      title = "下载 BIN 需要二次确认",
      onDismiss = { confirmDownloadTokenId = null },
      onConfirm = { password, totpCode, recoveryCode ->
        scope.launch {
          when (viewModel.confirmSensitiveAction(password, totpCode, recoveryCode)) {
            is ApiResult.Success -> {
              val targetTokenId = confirmDownloadTokenId
              confirmDownloadTokenId = null
              if (targetTokenId != null) {
                viewModel.requestBinDownload(targetTokenId)
              }
            }
            is ApiResult.Failure -> snackbarHostState.showSnackbar("二次确认失败")
          }
        }
      },
    )
  }
}

@Composable
fun RoleManagementScreen(
  viewModel: RoleManagementViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  var editingRole by remember { mutableStateOf<GameRole?>(null) }
  var showingEditor by rememberSaveable { mutableStateOf(false) }
  var detailRole by remember { mutableStateOf<GameRole?>(null) }

  DetailScaffold(
    title = "角色管理",
    onBack = onBack,
    actions = {
      IconButton(onClick = viewModel::refresh) {
        Icon(Icons.Outlined.Refresh, contentDescription = "刷新角色")
      }
      IconButton(onClick = {
        editingRole = null
        showingEditor = true
      }) {
        Icon(Icons.Outlined.Edit, contentDescription = "新增角色")
      }
    },
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      if (uiState.errorMessage != null) {
        ErrorHint(uiState.errorMessage ?: "")
      }
      if (uiState.roles.isEmpty() && !uiState.isLoading) {
        EmptyHint("还没有角色，点击右上角新增。")
      } else {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
          items(uiState.roles, key = { it.id }) { role ->
            Card {
              Column(
                modifier = Modifier
                  .fillMaxWidth()
                  .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
              ) {
                Text(role.name, style = MaterialTheme.typography.titleMedium)
                Text("${role.server} / ${role.profession} / 等级 ${role.level}")
                Text(if (role.isActive) "状态：启用" else "状态：停用")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                  OutlinedButton(
                    onClick = {
                      detailRole = role
                      scope.launch { viewModel.loadRoleDetail(role.id) }
                    },
                  ) { Text("详情") }
                  OutlinedButton(
                    onClick = {
                      editingRole = role
                      showingEditor = true
                    },
                  ) { Text("编辑") }
                  OutlinedButton(
                    onClick = {
                      scope.launch { viewModel.deleteRole(role.id) }
                    },
                  ) { Text("删除") }
                }
              }
            }
          }
        }
      }
    }
  }

  if (showingEditor) {
    RoleEditorDialog(
      initialRole = editingRole,
      onDismiss = { showingEditor = false },
      onSubmit = { request ->
        scope.launch {
          when (viewModel.saveRole(editingRole?.id, request)) {
            is ApiResult.Success -> {
              showingEditor = false
              editingRole = null
            }
            is ApiResult.Failure -> Unit
          }
        }
      },
    )
  }

  if (detailRole != null) {
    val selectedRole = uiState.selectedRole ?: detailRole
    AlertDialog(
      onDismissRequest = { detailRole = null },
      confirmButton = {
        TextButton(onClick = { detailRole = null }) { Text("关闭") }
      },
      title = { Text("角色详情") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("名称：${selectedRole?.name.orEmpty()}")
          Text("服务器：${selectedRole?.server.orEmpty()}")
          Text("职业：${selectedRole?.profession.orEmpty()}")
          Text("等级：${selectedRole?.level ?: 0}")
          Text("账号：${selectedRole?.account.orEmpty()}")
          Text("备注：${selectedRole?.note.orEmpty()}")
          Text("状态：${if (selectedRole?.isActive == true) "启用" else "停用"}")
        }
      },
    )
  }
}

@Composable
fun DailyTasksScreen(
  viewModel: DailyTasksViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  DetailScaffold(
    title = "日常任务",
    onBack = onBack,
    actions = {
      IconButton(onClick = { viewModel.refresh() }) {
        Icon(Icons.Outlined.Refresh, contentDescription = "刷新任务")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item {
        SectionCard(
          title = "角色选择",
          description = "先选择角色，再查看任务状态和历史。",
        ) {
          if (uiState.roles.isEmpty()) {
            EmptyHint("还没有角色，请先到工作台添加角色。")
          } else {
            FlowRow(
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
              uiState.roles.forEach { role ->
                FilterChip(
                  selected = uiState.selectedRoleId == role.id,
                  onClick = { viewModel.selectRole(role.id) },
                  label = { Text(role.name) },
                )
              }
            }
          }
        }
      }

      item {
        HubSummaryCards(
          cards = listOf(
            "任务总数" to uiState.statusSummary.total.toString(),
            "已完成" to uiState.statusSummary.completed.toString(),
            "进度" to "${uiState.statusSummary.percentage}%",
          ),
        )
      }

      item {
        SectionCard(
          title = "任务列表",
          description = "支持执行一次、启用/停用和自动执行切换。",
        ) {
          when {
            uiState.isLoading -> Text("任务加载中…")
            uiState.tasks.isEmpty() -> EmptyHint("当前角色还没有任务。")
            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
              uiState.tasks.forEach { task ->
                DailyTaskCard(
                  task = task,
                  onComplete = { viewModel.completeTask(task.id) },
                  onToggleEnabled = { enabled ->
                    viewModel.updateTask(task, enabled, task.settings.autoExecute)
                  },
                  onToggleAutoExecute = { auto ->
                    viewModel.updateTask(task, task.settings.enabled, auto)
                  },
                )
              }
            }
          }
        }
      }

      item {
        SectionCard(
          title = "执行历史",
          description = "展示最近的任务执行记录。",
        ) {
          if (uiState.history.isEmpty()) {
            EmptyHint("暂无执行历史。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.history.forEach { row ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                  ) {
                    Text(row.title.ifBlank { row.taskKey }, fontWeight = FontWeight.SemiBold)
                    Text(row.message)
                    Text("${row.runAt} · ${row.source}")
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun TaskControlScreen(
  viewModel: TaskControlViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  DetailScaffold(
    title = "任务控制",
    onBack = onBack,
    actions = {
      IconButton(onClick = viewModel::refresh) {
        Icon(Icons.Outlined.Refresh, contentDescription = "刷新任务控制")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item {
        SectionCard(
          title = "操作",
          description = "刷新服务端状态，或清空本地展示缓存。",
        ) {
          FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = viewModel::refresh) { Text("刷新") }
            OutlinedButton(onClick = viewModel::clearLocalState) { Text("清空本地展示状态") }
            OutlinedButton(onClick = viewModel::clearServerLogs) { Text("清空日志") }
          }
        }
      }

      item {
        SectionCard(
          title = "任务状态",
          description = "显示当前保存的任务控制配置。",
        ) {
          if (uiState.state.tasks.isEmpty()) {
            EmptyHint("当前没有任务控制状态。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.state.tasks.forEach { task ->
                Card {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                  ) {
                    Text(task.id, fontWeight = FontWeight.SemiBold)
                    Text("启用：${if (task.enabled) "是" else "否"}")
                    Text("Cron：${task.cronExpr}")
                    Text("Token 数：${task.tokenIds.size}")
                    if (task.lastRunAt.isNotBlank()) {
                      Text("上次运行：${task.lastRunAt}")
                    }
                  }
                }
              }
            }
          }
        }
      }

      item {
        SectionCard(
          title = "任务日志",
          description = "服务端日志与本地实时事件统一展示。",
        ) {
          if (uiState.logs.isEmpty() && uiState.localEvents.isEmpty()) {
            EmptyHint("暂无任务日志。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.localEvents.forEach { event ->
                Text("实时事件：$event", color = MaterialTheme.colorScheme.primary)
              }
              uiState.logs.forEach { row ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                  ) {
                    Text(row.taskName.ifBlank { row.taskId.orEmpty() }, fontWeight = FontWeight.SemiBold)
                    Text(row.message)
                    Text("${row.status} · ${row.createdAt}")
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun ProfileSettingsScreen(
  viewModel: ProfileSettingsViewModel,
  preferences: AppPreferences,
  isAdmin: Boolean,
  onOpenAdminHub: () -> Unit,
  onOpenReferral: () -> Unit,
  onOpenFeedback: () -> Unit,
  onLogout: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val snackbarHostState = remember { SnackbarHostState() }
  var email by rememberSaveable(uiState.profile?.email) { mutableStateOf(uiState.profile?.email.orEmpty()) }
  var nickname by rememberSaveable(uiState.profile?.nickname) { mutableStateOf(uiState.profile?.nickname.orEmpty()) }
  var phone by rememberSaveable(uiState.profile?.phone) { mutableStateOf(uiState.profile?.phone.orEmpty()) }
  var currentPassword by rememberSaveable { mutableStateOf("") }
  var newPassword by rememberSaveable { mutableStateOf("") }
  var showConfirmRemoteBin by rememberSaveable { mutableStateOf(false) }
  var targetRemoteBinState by rememberSaveable { mutableStateOf(false) }

  LaunchedEffect(uiState.errorMessage) {
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
  }

  HubScaffold(
    title = "我的",
    snackbarHostState = snackbarHostState,
  ) {
    SectionCard(
      title = "资料",
      description = "展示和更新账号资料。",
    ) {
      Text("用户名：${uiState.profile?.username ?: "未登录"}")
      OutlinedTextField(
        value = email,
        onValueChange = { email = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("邮箱") },
      )
      OutlinedTextField(
        value = nickname,
        onValueChange = { nickname = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("昵称") },
      )
      OutlinedTextField(
        value = phone,
        onValueChange = { phone = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("手机号") },
      )
      Button(onClick = { viewModel.saveProfile(email, nickname, phone) }) {
        Icon(Icons.Outlined.Save, contentDescription = null)
        Text("保存资料")
      }
    }

    SectionCard(
      title = "安全",
      description = "修改密码、远程 BIN 开关和安全事件。",
    ) {
      Text("MFA：${if (uiState.profile?.mfaEnabled == true) "已启用" else "未启用"}")
      OutlinedTextField(
        value = currentPassword,
        onValueChange = { currentPassword = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("当前密码") },
      )
      OutlinedTextField(
        value = newPassword,
        onValueChange = { newPassword = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("新密码") },
      )
      Button(
        onClick = { viewModel.changePassword(currentPassword, newPassword) },
        enabled = currentPassword.isNotBlank() && newPassword.isNotBlank(),
      ) {
        Text("修改密码")
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text("远程 BIN 下载")
          Text(
            if (uiState.remoteBinDownloadEnabled) "已开启" else "未开启",
            style = MaterialTheme.typography.bodySmall,
          )
        }
        Switch(
          checked = uiState.remoteBinDownloadEnabled,
          onCheckedChange = { checked ->
            targetRemoteBinState = checked
            showConfirmRemoteBin = true
          },
        )
      }

      Text("刷新二次验证：${if (uiState.refreshSecondVerifyEnabled) "开启" else "关闭"}")
      if (isAdmin) {
        OutlinedButton(onClick = onOpenAdminHub) {
          Text("进入管理员中心")
        }
      }
      if (uiState.securityEvents.isNotEmpty()) {
        Text("最近安全事件", style = MaterialTheme.typography.titleMedium)
        uiState.securityEvents.take(5).forEach { row ->
          Text("${row.eventType} · ${row.createdAt}")
        }
      }
    }

    SectionCard(
      title = "偏好与功能入口",
      description = "主题模式、本地偏好和二级功能入口。",
    ) {
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        ThemeMode.entries.forEach { mode ->
          FilterChip(
            selected = preferences.themeMode == mode,
            onClick = { viewModel.setThemeMode(mode) },
            label = { Text(mode.name) },
          )
        }
      }
      Text("当前 API 地址：${preferences.apiBaseUrl}")
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        OutlinedButton(onClick = onOpenReferral) { Text("推广中心") }
        OutlinedButton(onClick = onOpenFeedback) { Text("反馈中心") }
        OutlinedButton(onClick = onLogout) { Text("退出登录") }
      }
    }
  }

  if (showConfirmRemoteBin) {
    SensitiveConfirmDialog(
      title = "切换远程 BIN 下载",
      onDismiss = { showConfirmRemoteBin = false },
      onConfirm = { password, totpCode, recoveryCode ->
        scope.launch {
          when (viewModel.confirmSensitiveAction(password, totpCode, recoveryCode)) {
            is ApiResult.Success -> {
              viewModel.updateRemoteBinDownload(targetRemoteBinState)
              showConfirmRemoteBin = false
            }
            is ApiResult.Failure -> snackbarHostState.showSnackbar("二次确认失败")
          }
        }
      },
    )
  }
}

@Composable
fun ReferralScreen(
  viewModel: ReferralViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  DetailScaffold(
    title = "推广中心",
    onBack = onBack,
    actions = {
      IconButton(onClick = viewModel::refresh) {
        Icon(Icons.Outlined.Refresh, contentDescription = "刷新推广数据")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item {
        HubSummaryCards(
          cards = listOf(
            "邀请人数" to uiState.overview.invitedUsersCount.toString(),
            "待结算" to (uiState.overview.pendingAmountCents / 100.0).toString(),
            "已结算" to (uiState.overview.paidAmountCents / 100.0).toString(),
          ),
        )
      }
      item {
        SectionCard(
          title = "推广资料",
          description = "如果还没有推广码，可以在这里生成。",
        ) {
          val profile = uiState.overview.profile
          if (profile == null) {
            Button(onClick = viewModel::generateProfile) {
              Text("生成推广码")
            }
          } else {
            Text("推广码：${profile.referralCode}")
            Text("分享链接：${profile.shareUrl}")
          }
        }
      }
      item {
        SectionCard(
          title = "转化记录",
          description = "只展示当前用户自己的推广转化。",
        ) {
          if (uiState.conversions.isEmpty()) {
            EmptyHint("暂无推广转化记录。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.conversions.forEach { row ->
                Card {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                  ) {
                    Text("${row.referredUsername} · ${row.featureScope}", fontWeight = FontWeight.SemiBold)
                    Text("返佣：${row.rewardAmountCents / 100.0}")
                    Text("状态：${row.rewardStatus}")
                    Text(row.createdAt)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun FeedbackScreen(
  viewModel: FeedbackViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  var type by rememberSaveable { mutableStateOf("bug") }
  var title by rememberSaveable { mutableStateOf("") }
  var content by rememberSaveable { mutableStateOf("") }

  DetailScaffold(
    title = "反馈中心",
    onBack = onBack,
    actions = {
      IconButton(onClick = viewModel::refresh) {
        Icon(Icons.Outlined.Refresh, contentDescription = "刷新反馈")
      }
    },
  ) { innerPadding ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item {
        SectionCard(
          title = "提交反馈",
          description = "普通用户只在这里创建和查看自己的反馈，管理员处理仍留在管理员工单页。",
        ) {
          FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("bug" to "Bug", "feature" to "功能建议", "other" to "其他").forEach { (value, label) ->
              FilterChip(
                selected = type == value,
                onClick = { type = value },
                label = { Text(label) },
              )
            }
          }
          OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("标题") },
          )
          OutlinedTextField(
            value = content,
            onValueChange = { content = it },
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
            label = { Text("内容") },
          )
          Button(
            onClick = {
              viewModel.submitFeedback(type, title, content)
              title = ""
              content = ""
            },
            enabled = title.isNotBlank() && content.isNotBlank(),
          ) {
            Text("提交反馈")
          }
        }
      }
      item {
        SectionCard(
          title = "反馈列表",
          description = "显示当前账号提交的反馈和处理状态。",
        ) {
          if (uiState.feedbacks.isEmpty() && !uiState.isLoading) {
            EmptyHint("暂无反馈记录。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.feedbacks.forEach { item ->
                Card {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                  ) {
                    Text(item.title, fontWeight = FontWeight.SemiBold)
                    Text(item.content)
                    Text("类型：${item.type} · 状态：${item.status}")
                    item.adminNote?.takeIf { it.isNotBlank() }?.let { note ->
                      Text("管理员备注：$note", color = MaterialTheme.colorScheme.primary)
                    }
                    Text(item.createdAt, style = MaterialTheme.typography.bodySmall)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun HubScaffold(
  title: String,
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
  content: @Composable ColumnScope.() -> Unit,
) {
  Scaffold(
    snackbarHost = { SnackbarHost(snackbarHostState) },
    topBar = {
      TopAppBar(title = { Text(title) })
    },
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
      content = content,
    )
  }
}

@Composable
private fun DetailScaffold(
  title: String,
  onBack: () -> Unit,
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
  actions: @Composable RowScope.() -> Unit = {},
  content: @Composable (paddingValues: androidx.compose.foundation.layout.PaddingValues) -> Unit,
) {
  Scaffold(
    snackbarHost = { SnackbarHost(snackbarHostState) },
    topBar = {
      TopAppBar(
        title = { Text(title) },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回")
          }
        },
        actions = actions,
      )
    },
    content = content,
  )
}

@Composable
private fun HubSummaryCards(cards: List<Pair<String, String>>) {
  FlowRow(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(12.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    cards.forEach { (label, value) ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          Text(label, style = MaterialTheme.typography.bodyMedium)
          Text(value, style = MaterialTheme.typography.headlineSmall)
        }
      }
    }
  }
}

@Composable
private fun HubEntryCard(
  title: String,
  description: String,
  action: String,
  onClick: () -> Unit,
) {
  Card {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text(title, style = MaterialTheme.typography.titleLarge)
      Text(description, style = MaterialTheme.typography.bodyMedium)
      Button(onClick = onClick) {
        Text(action)
      }
    }
  }
}

@Composable
private fun SectionCard(
  title: String,
  description: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  Card {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
      content = {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(description, style = MaterialTheme.typography.bodyMedium)
        content()
      },
    )
  }
}

@Composable
private fun EmptyHint(text: String) {
  Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun ErrorHint(text: String) {
  Text(text, color = MaterialTheme.colorScheme.error)
}

@Composable
private fun TokenCard(
  token: ImportedGameToken,
  onRefresh: () -> Unit,
  onUpload: () -> Unit,
  onDownload: () -> Unit,
  onDelete: () -> Unit,
  onDeleteBin: () -> Unit,
) {
  Card {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text(token.displayName, style = MaterialTheme.typography.titleMedium)
      Text("Token ID: ${token.id}")
      if (token.roleId.isNotBlank()) {
        Text("角色 ID: ${token.roleId}")
      }
      if (token.region.isNotBlank()) {
        Text("大区: ${token.region}")
      }
      Text("激活状态: ${if (token.activationActive) "可用" else if (token.activationBound) "已绑定但不可用" else "未绑定"}")
      token.activationExpiresAt?.let { Text("到期时间: $it") }
      Text("BIN：${if (token.binFilePresent) "已上传" else "未上传"}")
      token.lastError?.takeIf { it.isNotBlank() }?.let { error ->
        Text(error, color = MaterialTheme.colorScheme.error)
      }
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        OutlinedButton(onClick = onRefresh) {
          Icon(Icons.Outlined.Refresh, contentDescription = null)
          Text("校验状态")
        }
        OutlinedButton(onClick = onUpload) {
          Icon(Icons.Outlined.FileUpload, contentDescription = null)
          Text("上传 BIN")
        }
        OutlinedButton(onClick = onDownload, enabled = token.binFilePresent) {
          Icon(Icons.Outlined.Download, contentDescription = null)
          Text("下载 BIN")
        }
        OutlinedButton(onClick = onDeleteBin, enabled = token.binFilePresent) {
          Icon(Icons.Outlined.Delete, contentDescription = null)
          Text("删除 BIN")
        }
        OutlinedButton(onClick = onDelete) {
          Text("移除 Token")
        }
      }
    }
  }
}

@Composable
private fun DailyTaskCard(
  task: DailyTaskEntry,
  onComplete: () -> Unit,
  onToggleEnabled: (Boolean) -> Unit,
  onToggleAutoExecute: (Boolean) -> Unit,
) {
  Card {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text(task.title, style = MaterialTheme.typography.titleMedium)
      if (task.subtitle.isNotBlank()) {
        Text(task.subtitle, style = MaterialTheme.typography.bodyMedium)
      }
      Text("完成状态：${if (task.completed) "已完成" else "待完成"}")
      Text("执行权限：${if (task.canExecute) "可执行" else "未启用"}")
      Text("进度：${task.progress.current}/${task.progress.total}")
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Text("启用")
        Switch(
          checked = task.settings.enabled,
          onCheckedChange = onToggleEnabled,
        )
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Text("自动执行")
        Switch(
          checked = task.settings.autoExecute,
          onCheckedChange = onToggleAutoExecute,
        )
      }
      Button(onClick = onComplete, enabled = task.canExecute) {
        Text("执行一次")
      }
    }
  }
}

@Composable
private fun RoleEditorDialog(
  initialRole: GameRole?,
  onDismiss: () -> Unit,
  onSubmit: (GameRoleUpsertRequest) -> Unit,
) {
  var name by rememberSaveable(initialRole?.id) { mutableStateOf(initialRole?.name.orEmpty()) }
  var server by rememberSaveable(initialRole?.id) { mutableStateOf(initialRole?.server.orEmpty()) }
  var profession by rememberSaveable(initialRole?.id) { mutableStateOf(initialRole?.profession.orEmpty()) }
  var level by rememberSaveable(initialRole?.id) { mutableStateOf(initialRole?.level?.toString().orEmpty()) }
  var account by rememberSaveable(initialRole?.id) { mutableStateOf(initialRole?.account.orEmpty()) }
  var note by rememberSaveable(initialRole?.id) { mutableStateOf(initialRole?.note.orEmpty()) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(if (initialRole == null) "新增角色" else "编辑角色") },
    confirmButton = {
      TextButton(
        onClick = {
          onSubmit(
            GameRoleUpsertRequest(
              name = name,
              server = server,
              profession = profession,
              level = level.toIntOrNull() ?: 1,
              account = account,
              note = note,
              avatar = initialRole?.avatar ?: "/icons/xiaoyugan.png",
              isActive = initialRole?.isActive,
              exp = initialRole?.exp,
              gold = initialRole?.gold,
              vip = initialRole?.vip,
            ),
          )
        },
        enabled = name.isNotBlank() && server.isNotBlank() && profession.isNotBlank(),
      ) {
        Text("保存")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) { Text("取消") }
    },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("角色名称") })
        OutlinedTextField(value = server, onValueChange = { server = it }, label = { Text("服务器") })
        OutlinedTextField(value = profession, onValueChange = { profession = it }, label = { Text("职业") })
        OutlinedTextField(value = level, onValueChange = { level = it }, label = { Text("等级") })
        OutlinedTextField(value = account, onValueChange = { account = it }, label = { Text("账号信息") })
        OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("备注") }, minLines = 3)
      }
    },
  )
}

@Composable
private fun SensitiveConfirmDialog(
  title: String,
  onDismiss: () -> Unit,
  onConfirm: (password: String?, totpCode: String?, recoveryCode: String?) -> Unit,
) {
  var password by rememberSaveable { mutableStateOf("") }
  var totpCode by rememberSaveable { mutableStateOf("") }
  var recoveryCode by rememberSaveable { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(title) },
    confirmButton = {
      TextButton(
        onClick = {
          onConfirm(
            password.takeIf { it.isNotBlank() },
            totpCode.takeIf { it.isNotBlank() },
            recoveryCode.takeIf { it.isNotBlank() },
          )
        },
        enabled = password.isNotBlank() || totpCode.isNotBlank() || recoveryCode.isNotBlank(),
      ) {
        Text("确认")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) { Text("取消") }
    },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("填写当前密码，或填写 TOTP / 恢复码完成二次确认。")
        OutlinedTextField(
          value = password,
          onValueChange = { password = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("当前密码") },
        )
        OutlinedTextField(
          value = totpCode,
          onValueChange = { totpCode = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("TOTP 验证码") },
        )
        OutlinedTextField(
          value = recoveryCode,
          onValueChange = { recoveryCode = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("恢复码") },
        )
      }
    },
  )
}

private fun writePendingDownload(
  context: Context,
  uri: Uri,
  viewModel: TokenManagementViewModel,
  snackbarHostState: SnackbarHostState,
) {
  runCatching {
    context.contentResolver.openOutputStream(uri)?.use(viewModel::completePendingDownload)
      ?: throw IOException("无法打开输出流")
  }.onFailure {
    viewModel.cancelPendingDownload()
  }
}
