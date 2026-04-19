package com.xyzw.helper.ui.screens

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.xyzw.helper.data.model.AdminConfirmCredential
import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.data.network.ApiResult
import com.xyzw.helper.ui.components.XyzwFormField

data class AdminConfirmDialogRequest(
  val actionLabel: String,
  val onConfirmed: suspend () -> Unit,
)

fun Context.showToast(message: String) {
  Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}

fun Context.showApiResult(
  result: ApiResult<*>,
  successMessage: String,
): Boolean =
  when (result) {
    is ApiResult.Success -> {
      showToast(result.message ?: successMessage)
      true
    }

    is ApiResult.Failure -> {
      showToast(result.error.message)
      false
    }
  }

@Composable
fun AdminAccessDeniedScreen(
  onBack: () -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(24.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    Text("管理员中心", style = MaterialTheme.typography.headlineSmall)
    Text(
      text = ADMIN_FORBIDDEN_MESSAGE,
      color = MaterialTheme.colorScheme.error,
      style = MaterialTheme.typography.bodyLarge,
    )
    OutlinedButton(onClick = onBack) {
      Text("返回")
    }
  }
}

@Composable
fun AdminErrorBanner(
  message: String?,
) {
  if (message.isNullOrBlank()) return
  Card(
    modifier = Modifier.fillMaxWidth(),
  ) {
    Text(
      text = message,
      modifier = Modifier.padding(16.dp),
      color = MaterialTheme.colorScheme.error,
      style = MaterialTheme.typography.bodyMedium,
    )
  }
}

@Composable
fun AdminStatsRow(
  stats: List<Pair<String, String>>,
) {
  Column(
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    stats.chunked(2).forEach { row ->
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        row.forEach { (label, value) ->
          Card(
            modifier = Modifier.weight(1f),
          ) {
            Column(
              modifier = Modifier.padding(16.dp),
              verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
              Text(label, style = MaterialTheme.typography.labelMedium)
              Text(value, style = MaterialTheme.typography.titleLarge)
            }
          }
        }
      }
    }
  }
}

@Composable
fun AdminCardSection(
  title: String,
  subtitle: String? = null,
  modifier: Modifier = Modifier,
  content: @Composable ColumnScope.() -> Unit,
) {
  Card(modifier = modifier.fillMaxWidth()) {
    Column(
      modifier = Modifier.padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Text(title, style = MaterialTheme.typography.titleMedium)
      if (!subtitle.isNullOrBlank()) {
        Text(
          subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      content()
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreenScaffold(
  title: String,
  onBack: () -> Unit,
  actions: @Composable RowScope.() -> Unit = {},
  content: @Composable (PaddingValues) -> Unit,
) {
  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(title) },
        navigationIcon = {
          TextButton(onClick = onBack) {
            Icon(
              imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
              contentDescription = "返回",
              modifier = Modifier.size(18.dp),
            )
          }
        },
        actions = { actions() },
      )
    },
  ) { innerPadding ->
    Box(
      modifier = Modifier.fillMaxSize(),
    ) {
      content(innerPadding)
    }
  }
}

@Composable
fun AdminConfirmDialog(
  currentUser: AuthUser?,
  request: AdminConfirmDialogRequest?,
  onDismiss: () -> Unit,
  onConfirm: (AdminConfirmCredential, suspend () -> Unit) -> Unit,
) {
  if (request == null) return

  val mfaEnabled = currentUser?.mfaEnabled == true
  var mode by remember(request) { mutableStateOf(if (mfaEnabled) "totp" else "password") }
  var password by remember(request) { mutableStateOf("") }
  var totpCode by remember(request) { mutableStateOf("") }
  var recoveryCode by remember(request) { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("管理员确认") },
    text = {
      Column(
        modifier = Modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        Text("执行“${request.actionLabel}”前，需要管理员确认。")
        if (mfaEnabled) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
              selected = mode == "totp",
              onClick = { mode = "totp" },
              label = { Text("动态验证码") },
            )
            FilterChip(
              selected = mode == "recovery",
              onClick = { mode = "recovery" },
              label = { Text("恢复码") },
            )
          }
        } else {
          FilterChip(
            selected = true,
            onClick = { mode = "password" },
            label = { Text("密码") },
          )
        }

        when (mode) {
          "totp" -> {
            OutlinedTextField(
              value = totpCode,
              onValueChange = { totpCode = it.filter(Char::isDigit) },
              label = { Text("动态验证码") },
              keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                keyboardType = KeyboardType.Number,
              ),
              modifier = Modifier.fillMaxWidth(),
              singleLine = true,
            )
            XyzwFormField(
              value = recoveryCode,
              onValueChange = { recoveryCode = it.trim() },
              label = "恢复码（可选）",
              modifier = Modifier.testTag("admin-confirm-recovery-optional"),
              password = true,
            )
          }

          "recovery" -> {
            XyzwFormField(
              value = recoveryCode,
              onValueChange = { recoveryCode = it.trim() },
              label = "恢复码",
              modifier = Modifier.testTag("admin-confirm-recovery"),
              password = true,
            )
          }

          else -> {
            XyzwFormField(
              value = password,
              onValueChange = { password = it },
              label = "当前管理员密码",
              modifier = Modifier.testTag("admin-confirm-password"),
              password = true,
            )
          }
        }
      }
    },
    confirmButton = {
      TextButton(
        onClick = {
          onConfirm(
            AdminConfirmCredential(
              password = password.takeIf { it.isNotBlank() && mode == "password" },
              totpCode = totpCode.takeIf { it.isNotBlank() && mode == "totp" },
              recoveryCode = recoveryCode.takeIf { it.isNotBlank() && mode != "password" },
            ),
            request.onConfirmed,
          )
        },
      ) {
        Text("确认")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text("取消")
      }
    },
  )
}
