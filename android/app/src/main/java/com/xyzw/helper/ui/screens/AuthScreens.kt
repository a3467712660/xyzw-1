package com.xyzw.helper.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
  uiState: AuthUiState,
  onSubmit: (username: String, password: String, rememberMe: Boolean) -> Unit,
  onRegister: () -> Unit,
  onForgotPassword: () -> Unit,
) {
  var username by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  var rememberMe by rememberSaveable { mutableStateOf(false) }

  AuthFormShell(
    title = "XYZW 助手",
    subtitle = "使用现有后端会话登录原生安卓客户端。",
    errorMessage = uiState.errorMessage,
  ) {
    OutlinedTextField(
      value = username,
      onValueChange = { username = it },
      label = { Text("用户名") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    OutlinedTextField(
      value = password,
      onValueChange = { password = it },
      label = { Text("密码") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      visualTransformation = PasswordVisualTransformation(),
    )
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
      Text("记住我")
    }
    Button(
      onClick = { onSubmit(username.trim(), password, rememberMe) },
      enabled = !uiState.isLoading,
      modifier = Modifier.fillMaxWidth(),
    ) {
      if (uiState.isLoading) {
        CircularProgressIndicator()
      } else {
        Text("登录")
      }
    }
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
    ) {
      OutlinedButton(onClick = onRegister) { Text("注册") }
      OutlinedButton(onClick = onForgotPassword) { Text("找回密码") }
    }
  }
}

@Composable
fun MfaVerifyScreen(
  uiState: AuthUiState,
  onVerify: (code: String) -> Unit,
  onToggleRecoveryMode: () -> Unit,
) {
  var code by rememberSaveable { mutableStateOf("") }
  val label = if (uiState.useRecoveryCode) "恢复码" else "动态验证码"

  AuthFormShell(
    title = "二步验证",
    subtitle = "登录要求多重验证。支持动态验证码或恢复码。",
    errorMessage = uiState.errorMessage,
  ) {
    OutlinedTextField(
      value = code,
      onValueChange = { code = it.trim() },
      label = { Text(label) },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
      visualTransformation = if (uiState.useRecoveryCode) PasswordVisualTransformation() else VisualTransformation.None,
    )
    Button(
      onClick = { onVerify(code) },
      enabled = !uiState.isLoading,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Text(if (uiState.isLoading) "验证中…" else "提交验证")
    }
    OutlinedButton(
      onClick = onToggleRecoveryMode,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Text(if (uiState.useRecoveryCode) "改用动态验证码" else "改用恢复码")
    }
  }
}

@Composable
fun RegisterScreen(
  uiState: AuthUiState,
  onSubmit: (username: String, email: String, password: String, inviteCode: String, referralCode: String) -> Unit,
) {
  var username by rememberSaveable { mutableStateOf("") }
  var email by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  var inviteCode by rememberSaveable { mutableStateOf("") }
  var referralCode by rememberSaveable { mutableStateOf("") }

  AuthFormShell(
    title = "注册账号",
    subtitle = "提交后回到登录页，不自动登录。",
    errorMessage = uiState.errorMessage,
  ) {
    OutlinedTextField(
      value = username,
      onValueChange = { username = it },
      label = { Text("用户名") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    OutlinedTextField(
      value = email,
      onValueChange = { email = it },
      label = { Text("邮箱") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    OutlinedTextField(
      value = password,
      onValueChange = { password = it },
      label = { Text("密码") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      visualTransformation = PasswordVisualTransformation(),
    )
    OutlinedTextField(
      value = inviteCode,
      onValueChange = { inviteCode = it },
      label = { Text("邀请码") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    OutlinedTextField(
      value = referralCode,
      onValueChange = { referralCode = it },
      label = { Text("推广码") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    Button(
      onClick = { onSubmit(username.trim(), email.trim(), password, inviteCode.trim(), referralCode.trim()) },
      enabled = !uiState.isLoading,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Text(if (uiState.isLoading) "提交中…" else "注册")
    }
  }
}

@Composable
fun ForgotPasswordScreen(
  uiState: AuthUiState,
  onSubmit: (identity: String, shortCode: String, newPassword: String) -> Unit,
) {
  var identity by rememberSaveable { mutableStateOf("") }
  var shortCode by rememberSaveable { mutableStateOf("") }
  var newPassword by rememberSaveable { mutableStateOf("") }

  AuthFormShell(
    title = "重置密码",
    subtitle = "使用账号、短验证码和新密码调用后端密码重置接口。",
    errorMessage = uiState.errorMessage,
  ) {
    OutlinedTextField(
      value = identity,
      onValueChange = { identity = it },
      label = { Text("账号或邮箱") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    OutlinedTextField(
      value = shortCode,
      onValueChange = { shortCode = it.uppercase() },
      label = { Text("短验证码") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    OutlinedTextField(
      value = newPassword,
      onValueChange = { newPassword = it },
      label = { Text("新密码") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      visualTransformation = PasswordVisualTransformation(),
    )
    Button(
      onClick = { onSubmit(identity.trim(), shortCode.trim(), newPassword) },
      enabled = !uiState.isLoading,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Text(if (uiState.isLoading) "提交中…" else "更新密码")
    }
  }
}

@Composable
private fun AuthFormShell(
  title: String,
  subtitle: String,
  errorMessage: String?,
  content: @Composable ColumnScope.() -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(24.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Text(text = title, style = MaterialTheme.typography.headlineMedium)
    Text(text = subtitle, style = MaterialTheme.typography.bodyMedium)
    if (!errorMessage.isNullOrBlank()) {
      Text(
        text = errorMessage,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
      )
    }
    content()
  }
}
