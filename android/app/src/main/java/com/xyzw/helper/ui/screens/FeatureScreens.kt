@file:OptIn(
  androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
  androidx.compose.material3.ExperimentalMaterial3Api::class,
)

package com.xyzw.helper.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.xyzw.helper.BuildConfig
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
import androidx.compose.ui.platform.testTag
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
import com.xyzw.helper.data.token.validateBinUploadSize
import com.xyzw.helper.ui.components.SensitiveValueText
import com.xyzw.helper.ui.components.XyzwActionCard
import com.xyzw.helper.ui.components.XyzwConfirmDialog
import com.xyzw.helper.ui.components.XyzwEmptyState
import com.xyzw.helper.ui.components.XyzwErrorState
import com.xyzw.helper.ui.components.XyzwExpandableText
import com.xyzw.helper.ui.components.XyzwFormField
import com.xyzw.helper.ui.components.XyzwLoadingState
import com.xyzw.helper.ui.components.XyzwPage
import com.xyzw.helper.ui.components.XyzwSection
import com.xyzw.helper.ui.components.XyzwStatusChip
import com.xyzw.helper.ui.components.XyzwTopBar
import com.xyzw.helper.ui.components.XyzwTwoColumnStats
import com.xyzw.helper.ui.formatters.formatDisplayDateTime
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
        "已导入令牌" to tokenCount.toString(),
        "角色数量" to roleCount.toString(),
      ),
    )
    HubEntryCard(
      title = "令牌管理",
      description = "手动导入、链接导入、二进制文件上传导出与删除，都在这一页完成。",
      action = "进入令牌管理",
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
  var manualTokenName by rememberSaveable { mutableStateOf("") }
  var manualToken by rememberSaveable { mutableStateOf("") }
  var importUrl by rememberSaveable { mutableStateOf("") }
  var uploadTargetTokenId by rememberSaveable { mutableStateOf<String?>(null) }
  var confirmDownloadTokenId by rememberSaveable { mutableStateOf<String?>(null) }
  var confirmRemoveTokenId by rememberSaveable { mutableStateOf<String?>(null) }
  var confirmDeleteBinTokenId by rememberSaveable { mutableStateOf<String?>(null) }

  val openDocumentLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenDocument(),
  ) { uri ->
    val tokenId = uploadTargetTokenId
    uploadTargetTokenId = null
    if (uri == null || tokenId == null) return@rememberLauncherForActivityResult
    val sizeBytes = queryContentSize(context, uri)
    val sizeError = validateBinUploadSize(sizeBytes)
    if (sizeError != null) {
      scope.launch { snackbarHostState.showSnackbar(sizeError) }
      return@rememberLauncherForActivityResult
    }
    viewModel.uploadBinFile(
      tokenId = tokenId,
      contentLength = sizeBytes?.takeIf { it >= 0 },
      inputStreamProvider = {
        context.contentResolver.openInputStream(uri)
          ?: throw IOException("无法打开二进制文件")
      },
    )
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
    title = "令牌管理",
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
          description = "填写名称并粘贴完整令牌文本，保存到本地加密工作区。",
        ) {
          OutlinedTextField(
            value = manualTokenName,
            onValueChange = { manualTokenName = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("令牌名称") },
            singleLine = true,
          )
          XyzwFormField(
            value = manualToken,
            onValueChange = { manualToken = it },
            minLines = 4,
            label = "令牌",
            password = true,
            helper = "敏感内容默认隐藏，确认无误后再导入。",
          )
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
              onClick = { viewModel.importManual(manualToken, manualTokenName) },
              enabled = manualToken.isNotBlank() && !uiState.isImporting,
            ) {
              Text(if (uiState.isImporting) "导入中…" else "导入令牌")
            }
            OutlinedButton(onClick = {
              manualToken = ""
              manualTokenName = ""
            }) {
              Text("清空")
            }
          }
        }
      }

      item {
        SectionCard(
          title = "链接导入",
          description = "通过受信任链接和后端代理拉取配置文本，再解析出可用令牌。",
        ) {
          OutlinedTextField(
            value = importUrl,
            onValueChange = { importUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("受信任链接") },
          )
          Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
              onClick = { viewModel.importFromUrl(importUrl) },
              enabled = importUrl.isNotBlank() && !uiState.isImporting,
            ) {
              Text(if (uiState.isImporting) "拉取中…" else "链接导入")
            }
            OutlinedButton(onClick = { importUrl = "" }) {
              Text("清空")
            }
          }
        }
      }

      item {
        SectionCard(
          title = "已导入令牌",
          description = "每个令牌都会显示激活状态和二进制文件关联状态。",
        ) {
          if (uiState.tokens.isEmpty()) {
            EmptyHint("当前还没有导入令牌。")
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
                  onDelete = { confirmRemoveTokenId = token.id },
                  onDeleteBin = { confirmDeleteBinTokenId = token.id },
                )
              }
            }
          }
        }
      }

      item {
        SectionCard(
          title = "二进制文件",
          description = "服务端已保存的二进制文件清单。",
        ) {
          if (uiState.binFiles.isEmpty()) {
            EmptyHint("没有找到已上传的二进制文件。")
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
                    Text("令牌编号：${item.tokenId}")
                    Text("大小：${item.size} 字节")
                    Text("更新时间：${formatDisplayDateTime(item.updatedAt)}")
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
      title = "导出二进制文件需要二次确认",
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

  if (confirmRemoveTokenId != null) {
    TokenDeleteConfirmDialog(
      onConfirm = {
        val tokenId = confirmRemoveTokenId
        confirmRemoveTokenId = null
        if (tokenId != null) {
          viewModel.removeToken(tokenId)
        }
      },
      onDismiss = { confirmRemoveTokenId = null },
    )
  }

  if (confirmDeleteBinTokenId != null) {
    BinDeleteConfirmDialog(
      onConfirm = {
        val tokenId = confirmDeleteBinTokenId
        confirmDeleteBinTokenId = null
        if (tokenId != null) {
          viewModel.deleteBinFile(tokenId)
        }
      },
      onDismiss = { confirmDeleteBinTokenId = null },
    )
  }
}

@Composable
internal fun TokenDeleteConfirmDialog(
  onConfirm: () -> Unit,
  onDismiss: () -> Unit,
) {
  XyzwConfirmDialog(
    title = "删除令牌",
    message = "确认从本机加密工作区移除该令牌？服务端二进制文件不会自动删除。",
    confirmLabel = "删除",
    destructive = true,
    onConfirm = onConfirm,
    onDismiss = onDismiss,
  )
}

@Composable
internal fun BinDeleteConfirmDialog(
  onConfirm: () -> Unit,
  onDismiss: () -> Unit,
) {
  XyzwConfirmDialog(
    title = "删除二进制文件",
    message = "确认删除服务端保存的二进制文件？删除后需要重新上传。",
    confirmLabel = "删除",
    destructive = true,
    onConfirm = onConfirm,
    onDismiss = onDismiss,
  )
}

@Composable
fun RoleManagementScreen(
  viewModel: RoleManagementViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val scope = rememberCoroutineScope()
  val snackbarHostState = remember { SnackbarHostState() }
  var editingRole by remember { mutableStateOf<GameRole?>(null) }
  var showingEditor by rememberSaveable { mutableStateOf(false) }
  var detailRole by remember { mutableStateOf<GameRole?>(null) }
  var confirmDeleteRole by remember { mutableStateOf<GameRole?>(null) }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }

  DetailScaffold(
    title = "角色管理",
    onBack = onBack,
    snackbarHostState = snackbarHostState,
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
                      confirmDeleteRole = role
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

  if (confirmDeleteRole != null) {
    RoleDeleteConfirmDialog(
      roleName = confirmDeleteRole?.name.orEmpty(),
      onConfirm = {
        val target = confirmDeleteRole
        confirmDeleteRole = null
        if (target != null) {
          scope.launch { viewModel.deleteRole(target.id) }
        }
      },
      onDismiss = { confirmDeleteRole = null },
    )
  }
}

@Composable
internal fun RoleDeleteConfirmDialog(
  roleName: String,
  onConfirm: () -> Unit,
  onDismiss: () -> Unit,
) {
  XyzwConfirmDialog(
    title = "删除角色",
    message = "确认删除角色“$roleName”？删除后需要重新创建。",
    confirmLabel = "删除",
    destructive = true,
    onConfirm = onConfirm,
    onDismiss = onDismiss,
  )
}

@Composable
fun DailyTasksScreen(
  viewModel: DailyTasksViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  var configuringTask by remember { mutableStateOf<DailyTaskEntry?>(null) }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }

  DetailScaffold(
    title = "日常任务",
    onBack = onBack,
    snackbarHostState = snackbarHostState,
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
            XyzwEmptyState(
              title = "还没有角色",
              description = "请先到工作台添加角色，再配置日常任务。",
            )
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
                  onConfigure = { configuringTask = task },
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
                    Text("${formatDisplayDateTime(row.runAt)} · ${taskSourceLabel(row.source)}")
                  }
                }
              }
              if (uiState.hasMoreHistory) {
                OutlinedButton(
                  onClick = viewModel::loadMoreHistory,
                  enabled = !uiState.isLoadingMoreHistory,
                  modifier = Modifier.fillMaxWidth(),
                ) {
                  Text(if (uiState.isLoadingMoreHistory) "加载中…" else "加载更多")
                }
              }
            }
          }
        }
      }
    }
  }

  configuringTask?.let { task ->
    DailyTaskConfigDialog(
      task = task,
      onDismiss = { configuringTask = null },
      onSave = { enabled, autoExecute, notification, delay, cronExpr ->
        viewModel.updateTaskSettings(
          task = task,
          enabled = enabled,
          autoExecute = autoExecute,
          notification = notification,
          delay = delay,
          cronExpr = cronExpr,
        )
        configuringTask = null
      },
    )
  }
}

@Composable
fun TaskControlScreen(
  viewModel: TaskControlViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  var confirmClearLogs by rememberSaveable { mutableStateOf(false) }
  var cronEditTarget by remember { mutableStateOf<com.xyzw.helper.data.model.TaskControlTaskRow?>(null) }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }

  DetailScaffold(
    title = "任务控制",
    onBack = onBack,
    snackbarHostState = snackbarHostState,
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
            OutlinedButton(onClick = { confirmClearLogs = true }) { Text("清空日志") }
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
                    Text("定时表达式：${task.cronExpr}")
                    Text("令牌数：${task.tokenIds.size}")
                    if (task.lastRunAt.isNotBlank()) {
                      Text("上次运行：${formatDisplayDateTime(task.lastRunAt)}")
                    }
                    Row(
                      modifier = Modifier.fillMaxWidth(),
                      horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                      Text("启用任务")
                      Switch(
                        checked = task.enabled,
                        onCheckedChange = { viewModel.updateTaskEnabled(task, it) },
                        enabled = !uiState.isMutating,
                      )
                    }
                    OutlinedButton(
                      onClick = { cronEditTarget = task },
                      modifier = Modifier.fillMaxWidth(),
                      enabled = !uiState.isMutating,
                    ) {
                      Text("编辑定时表达式")
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
          FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("" to "全部", "success" to "成功", "failed" to "失败", "running" to "运行中").forEach { (value, label) ->
              FilterChip(
                selected = uiState.statusFilter == value,
                onClick = { viewModel.setStatusFilter(value) },
                label = { Text(label) },
              )
            }
          }
          val visibleLogs = uiState.logs.filter { row ->
            uiState.statusFilter.isBlank() || row.status.equals(uiState.statusFilter, ignoreCase = true)
          }
          if (visibleLogs.isEmpty() && uiState.localEvents.isEmpty()) {
            EmptyHint("暂无任务日志。")
          } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
              uiState.localEvents.forEach { event ->
                Text("实时事件：$event", color = MaterialTheme.colorScheme.primary)
              }
              visibleLogs.forEach { row ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                  Column(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                  ) {
                    Text(row.taskName.ifBlank { row.taskId.orEmpty() }, fontWeight = FontWeight.SemiBold)
                    XyzwExpandableText(row.message)
                    Text("${taskStatusLabel(row.status)} · ${formatDisplayDateTime(row.createdAt)}")
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (confirmClearLogs) {
    XyzwConfirmDialog(
      title = "清空任务日志",
      message = "确认清空服务端任务控制日志？该操作不可撤销。",
      confirmLabel = "清空",
      destructive = true,
      onConfirm = {
        confirmClearLogs = false
        viewModel.clearServerLogs()
      },
      onDismiss = { confirmClearLogs = false },
    )
  }

  cronEditTarget?.let { task ->
    TaskControlCronDialog(
      task = task,
      onDismiss = { cronEditTarget = null },
      onSave = { cronExpr ->
        cronEditTarget = null
        viewModel.updateTaskCron(task, cronExpr)
      },
    )
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
  var apiBaseUrlDraft by rememberSaveable(preferences.apiBaseUrl) { mutableStateOf(preferences.apiBaseUrl) }
  var currentPassword by rememberSaveable { mutableStateOf("") }
  var newPassword by rememberSaveable { mutableStateOf("") }
  var showConfirmPasswordChange by rememberSaveable { mutableStateOf(false) }
  var showConfirmRemoteBin by rememberSaveable { mutableStateOf(false) }
  var showConfirmLogout by rememberSaveable { mutableStateOf(false) }
  var targetRemoteBinState by rememberSaveable { mutableStateOf(false) }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
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
      description = "修改密码、远程二进制文件开关和安全事件。",
    ) {
      Text("多重验证：${if (uiState.profile?.mfaEnabled == true) "已启用" else "未启用"}")
      ProfilePasswordFields(
        currentPassword = currentPassword,
        newPassword = newPassword,
        onCurrentPasswordChange = { currentPassword = it },
        onNewPasswordChange = { newPassword = it },
        onSubmit = { showConfirmPasswordChange = true },
      )

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text("远程二进制文件导出")
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
          Text("${securityEventLabel(row.eventType)} · ${formatDisplayDateTime(row.createdAt)}")
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
      if (BuildConfig.DEBUG) {
        OutlinedTextField(
          value = apiBaseUrlDraft,
          onValueChange = { apiBaseUrlDraft = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("调试接口地址") },
          singleLine = true,
        )
        OutlinedButton(
          onClick = { viewModel.setApiBaseUrl(apiBaseUrlDraft) },
          enabled = apiBaseUrlDraft.startsWith("http://") || apiBaseUrlDraft.startsWith("https://"),
        ) {
          Text("保存接口地址")
        }
      } else {
        Text("当前接口地址：${preferences.apiBaseUrl}")
        Text("正式包不允许在界面中改成明文地址。", style = MaterialTheme.typography.bodySmall)
      }
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        OutlinedButton(onClick = onOpenReferral) { Text("推广中心") }
        OutlinedButton(onClick = onOpenFeedback) { Text("反馈中心") }
        OutlinedButton(onClick = { showConfirmLogout = true }) { Text("退出登录") }
      }
    }
  }

  if (showConfirmPasswordChange) {
    SensitiveConfirmDialog(
      title = "修改密码需要二次确认",
      onDismiss = { showConfirmPasswordChange = false },
      onConfirm = { password, totpCode, recoveryCode ->
        scope.launch {
          when (viewModel.confirmSensitiveAction(password, totpCode, recoveryCode)) {
            is ApiResult.Success -> {
              showConfirmPasswordChange = false
              viewModel.changePassword(currentPassword, newPassword)
            }
            is ApiResult.Failure -> snackbarHostState.showSnackbar("二次确认失败")
          }
        }
      },
    )
  }

  if (showConfirmRemoteBin) {
    SensitiveConfirmDialog(
      title = "切换远程二进制文件导出",
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

  if (showConfirmLogout) {
    XyzwConfirmDialog(
      title = "退出登录",
      message = "确认退出当前账号？退出后会清除本机会话并关闭实时连接。",
      confirmLabel = "退出登录",
      destructive = true,
      onConfirm = {
        showConfirmLogout = false
        onLogout()
      },
      onDismiss = { showConfirmLogout = false },
    )
  }
}

@Composable
fun ReferralScreen(
  viewModel: ReferralViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val context = LocalContext.current
  val snackbarHostState = remember { SnackbarHostState() }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }

  DetailScaffold(
    title = "推广中心",
    onBack = onBack,
    snackbarHostState = snackbarHostState,
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
            ReferralShareButton(
              referralCode = profile.referralCode,
              shareUrl = profile.shareUrl,
              onShare = { shareText ->
                context.startActivity(
                  Intent.createChooser(
                    Intent(Intent.ACTION_SEND).apply {
                      type = "text/plain"
                      putExtra(Intent.EXTRA_TEXT, shareText)
                    },
                    "分享推广信息",
                  ),
                )
              },
            )
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
                    Text("${row.referredUsername} · ${featureScopeDisplayLabel(row.featureScope)}", fontWeight = FontWeight.SemiBold)
                    Text("返佣：${row.rewardAmountCents / 100.0}")
                    Text("状态：${rewardStatusDisplayLabel(row.rewardStatus)}")
                    Text(formatDisplayDateTime(row.createdAt))
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
internal fun ReferralShareButton(
  referralCode: String,
  shareUrl: String,
  onShare: (String) -> Unit,
) {
  OutlinedButton(
    onClick = {
      val shareText = if (shareUrl.isNotBlank()) {
        "使用我的推广链接注册：$shareUrl"
      } else {
        "使用我的推广码注册：$referralCode"
      }
      onShare(shareText)
    },
    modifier = Modifier.fillMaxWidth(),
  ) {
    Text("系统分享")
  }
}

@Composable
internal fun ProfilePasswordFields(
  currentPassword: String,
  newPassword: String,
  onCurrentPasswordChange: (String) -> Unit,
  onNewPasswordChange: (String) -> Unit,
  onSubmit: () -> Unit,
) {
  XyzwFormField(
    value = currentPassword,
    onValueChange = onCurrentPasswordChange,
    label = "当前密码",
    modifier = Modifier.testTag("profile-current-password"),
    password = true,
  )
  XyzwFormField(
    value = newPassword,
    onValueChange = onNewPasswordChange,
    label = "新密码",
    modifier = Modifier.testTag("profile-new-password"),
    password = true,
  )
  Button(
    onClick = onSubmit,
    enabled = currentPassword.isNotBlank() && newPassword.isNotBlank(),
  ) {
    Text("修改密码")
  }
}

@Composable
fun FeedbackScreen(
  viewModel: FeedbackViewModel,
  onBack: () -> Unit,
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val snackbarHostState = remember { SnackbarHostState() }
  var type by rememberSaveable { mutableStateOf("bug") }
  var title by rememberSaveable { mutableStateOf("") }
  var content by rememberSaveable { mutableStateOf("") }

  LaunchedEffect(uiState.clearDraftSignal) {
    if (uiState.clearDraftSignal > 0) {
      title = ""
      content = ""
    }
  }

  LaunchedEffect(uiState.actionMessage, uiState.errorMessage) {
    uiState.actionMessage?.let { snackbarHostState.showSnackbar(it) }
    uiState.errorMessage?.let { snackbarHostState.showSnackbar(it) }
    if (uiState.actionMessage != null || uiState.errorMessage != null) {
      viewModel.consumeMessage()
    }
  }

  DetailScaffold(
    title = "反馈中心",
    onBack = onBack,
    snackbarHostState = snackbarHostState,
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
          FeedbackSubmitForm(
            type = type,
            title = title,
            content = content,
            isSubmitting = uiState.isSubmitting,
            onTypeChange = { type = it },
            onTitleChange = { title = it },
            onContentChange = { content = it },
            onSubmit = { viewModel.submitFeedback(type, title, content) },
          )
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
                    XyzwExpandableText(item.content)
                    Text("类型：${feedbackTypeDisplayLabel(item.type)}")
                    XyzwStatusChip(
                      status = item.status,
                      label = when (item.status) {
                        "pending", "open" -> "待处理"
                        "processing", "in_progress" -> "处理中"
                        "resolved" -> "已解决"
                        "rejected" -> "已驳回"
                        else -> item.status
                      },
                    )
                    item.adminNote?.takeIf { it.isNotBlank() }?.let { note ->
                      XyzwExpandableText("管理员备注：$note")
                    }
                    Text(formatDisplayDateTime(item.createdAt), style = MaterialTheme.typography.bodySmall)
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
internal fun FeedbackSubmitForm(
  type: String,
  title: String,
  content: String,
  isSubmitting: Boolean,
  onTypeChange: (String) -> Unit,
  onTitleChange: (String) -> Unit,
  onContentChange: (String) -> Unit,
  onSubmit: () -> Unit,
) {
  FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    listOf("bug" to "Bug", "feature" to "功能建议", "other" to "其他").forEach { (value, label) ->
      FilterChip(
        selected = type == value,
        onClick = { onTypeChange(value) },
        label = { Text(label) },
      )
    }
  }
  OutlinedTextField(
    value = title,
    onValueChange = onTitleChange,
    modifier = Modifier.fillMaxWidth().testTag("feedback-title"),
    label = { Text("标题") },
  )
  OutlinedTextField(
    value = content,
    onValueChange = onContentChange,
    modifier = Modifier.fillMaxWidth().testTag("feedback-content"),
    minLines = 4,
    label = { Text("内容") },
  )
  Button(
    onClick = onSubmit,
    modifier = Modifier.testTag("feedback-submit"),
    enabled = title.isNotBlank() && content.isNotBlank() && !isSubmitting,
  ) {
    Text(if (isSubmitting) "提交中…" else "提交反馈")
  }
}

@Composable
private fun HubScaffold(
  title: String,
  snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
  content: @Composable ColumnScope.() -> Unit,
) {
  XyzwPage(
    title = title,
    snackbarHostState = snackbarHostState,
    content = content,
  )
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
      XyzwTopBar(
        title = title,
        onBack = onBack,
        actions = actions,
      )
    },
    content = content,
  )
}

@Composable
private fun HubSummaryCards(cards: List<Pair<String, String>>) {
  XyzwTwoColumnStats(cards.map { (label, value) -> Triple(label, value, null) })
}

@Composable
private fun HubEntryCard(
  title: String,
  description: String,
  action: String,
  onClick: () -> Unit,
) {
  XyzwActionCard(
    title = title,
    subtitle = "$description\n$action",
    onClick = onClick,
  )
}

@Composable
private fun SectionCard(
  title: String,
  description: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  XyzwSection(title = title, subtitle = description, content = content)
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
      Text("令牌编号：${token.id}")
      SensitiveValueText(label = "令牌内容", value = token.rawToken)
      if (token.roleId.isNotBlank()) {
        Text("角色编号：${token.roleId}")
      }
      if (token.region.isNotBlank()) {
        Text("大区：${token.region}")
      }
      XyzwStatusChip(
        status = if (token.activationActive) "active" else if (token.activationBound) "pending" else "disabled",
        label = if (token.activationActive) "可用" else if (token.activationBound) "已绑定但不可用" else "未绑定",
      )
      token.activationExpiresAt?.let { Text("到期时间：${formatDisplayDateTime(it)}") }
      XyzwStatusChip(
        status = if (token.binFilePresent) "enabled" else "disabled",
        label = if (token.binFilePresent) "二进制文件已上传" else "二进制文件未上传",
      )
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
          Text("上传二进制文件")
        }
        OutlinedButton(onClick = onDownload, enabled = token.binFilePresent) {
          Icon(Icons.Outlined.Download, contentDescription = null)
          Text("导出二进制文件")
        }
        OutlinedButton(onClick = onDeleteBin, enabled = token.binFilePresent) {
          Icon(Icons.Outlined.Delete, contentDescription = null)
          Text("删除二进制文件")
        }
        OutlinedButton(onClick = onDelete) {
          Text("移除令牌")
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
  onConfigure: () -> Unit,
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
      Text("延迟：${task.settings.delay}s · 通知：${if (task.settings.notification) "开启" else "关闭"}")
      Text("定时表达式：${task.settings.cronExpr.ifBlank { "--" }}")
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
      OutlinedButton(onClick = onConfigure, modifier = Modifier.fillMaxWidth()) {
        Text("编辑配置")
      }
    }
  }
}

@Composable
private fun TaskControlCronDialog(
  task: com.xyzw.helper.data.model.TaskControlTaskRow,
  onDismiss: () -> Unit,
  onSave: (String) -> Unit,
) {
  var cronExpr by rememberSaveable(task.id) { mutableStateOf(task.cronExpr) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("编辑定时表达式") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(task.id, style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(
          value = cronExpr,
          onValueChange = { cronExpr = it },
          label = { Text("定时表达式") },
          modifier = Modifier.fillMaxWidth(),
          singleLine = true,
        )
      }
    },
    confirmButton = {
      TextButton(onClick = { onSave(cronExpr.trim()) }) {
        Text("保存")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text("取消")
      }
    },
  )
}

@Composable
internal fun DailyTaskConfigDialog(
  task: DailyTaskEntry,
  onDismiss: () -> Unit,
  onSave: (enabled: Boolean, autoExecute: Boolean, notification: Boolean, delay: Int, cronExpr: String) -> Unit,
) {
  var enabled by rememberSaveable(task.id) { mutableStateOf(task.settings.enabled) }
  var autoExecute by rememberSaveable(task.id) { mutableStateOf(task.settings.autoExecute) }
  var notification by rememberSaveable(task.id) { mutableStateOf(task.settings.notification) }
  var delay by rememberSaveable(task.id) { mutableStateOf(task.settings.delay.toString()) }
  var cronExpr by rememberSaveable(task.id) { mutableStateOf(task.settings.cronExpr) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("任务配置") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(task.title, style = MaterialTheme.typography.titleMedium)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
          Text("启用")
          Switch(checked = enabled, onCheckedChange = { enabled = it })
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
          Text("自动执行")
          Switch(checked = autoExecute, onCheckedChange = { autoExecute = it })
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
          Text("通知")
          Switch(
            checked = notification,
            onCheckedChange = { notification = it },
            modifier = Modifier.testTag("daily-task-notification"),
          )
        }
        OutlinedTextField(
          value = delay,
          onValueChange = { delay = it.filter(Char::isDigit) },
          label = { Text("延迟（秒）") },
          modifier = Modifier.fillMaxWidth().testTag("daily-task-delay"),
          singleLine = true,
        )
        OutlinedTextField(
          value = cronExpr,
          onValueChange = { cronExpr = it },
          label = { Text("定时表达式") },
          modifier = Modifier.fillMaxWidth().testTag("daily-task-cron"),
          singleLine = true,
        )
      }
    },
    confirmButton = {
      TextButton(
        onClick = {
          onSave(enabled, autoExecute, notification, delay.toIntOrNull() ?: 0, cronExpr.trim())
        },
        modifier = Modifier.testTag("daily-task-save"),
      ) {
        Text("保存")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) { Text("取消") }
    },
  )
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
        Text("填写当前密码，或填写动态验证码 / 恢复码完成二次确认。")
        XyzwFormField(
          value = password,
          onValueChange = { password = it },
          label = "当前密码",
          password = true,
        )
        OutlinedTextField(
          value = totpCode,
          onValueChange = { totpCode = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("动态验证码") },
        )
        XyzwFormField(
          value = recoveryCode,
          onValueChange = { recoveryCode = it },
          label = "恢复码",
          password = true,
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
  viewModel.downloadPendingBin {
    context.contentResolver.openOutputStream(uri)
      ?: throw IOException("无法打开输出流")
  }
}

private fun queryContentSize(
  context: Context,
  uri: Uri,
): Long? =
  runCatching {
    context.contentResolver.query(
      uri,
      arrayOf(OpenableColumns.SIZE),
      null,
      null,
      null,
    )?.use { cursor ->
      val index = cursor.getColumnIndex(OpenableColumns.SIZE)
      if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) {
        cursor.getLong(index)
      } else {
        null
      }
    }
  }.getOrNull()

private fun taskSourceLabel(value: String): String =
  when (value.lowercase()) {
    "manual" -> "手动"
    "auto" -> "自动"
    "schedule", "scheduled" -> "定时"
    else -> value.ifBlank { "--" }
  }

private fun taskStatusLabel(value: String): String =
  when (value.lowercase()) {
    "success" -> "成功"
    "failed", "error" -> "失败"
    "running" -> "运行中"
    "pending" -> "等待中"
    "info" -> "信息"
    else -> value.ifBlank { "--" }
  }

private fun securityEventLabel(value: String): String =
  when (value) {
    "bin_upload" -> "二进制文件上传"
    "bin_download" -> "二进制文件导出"
    "bin_delete" -> "二进制文件删除"
    "csrf_validation_failed" -> "安全校验失败"
    else -> value.ifBlank { "--" }
  }

private fun featureScopeDisplayLabel(value: String): String =
  when (value) {
    "task_control_only" -> "普通版"
    "full" -> "全功能"
    else -> value.ifBlank { "--" }
  }

private fun rewardStatusDisplayLabel(value: String): String =
  when (value) {
    "pending" -> "待结算"
    "paid" -> "已结算"
    "rejected" -> "已驳回"
    else -> value.ifBlank { "--" }
  }

private fun feedbackTypeDisplayLabel(value: String): String =
  when (value) {
    "bug" -> "问题反馈"
    "feature" -> "功能建议"
    "contact" -> "联系请求"
    else -> value.ifBlank { "--" }
  }
