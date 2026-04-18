package com.xyzw.helper.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import com.xyzw.helper.data.storage.ThemeMode

private val LightColors = lightColorScheme(
  primary = Blue600,
  secondary = Teal500,
  background = SurfaceLight,
  surface = SurfaceLight,
)

private val DarkColors = darkColorScheme(
  primary = Blue400,
  secondary = Teal300,
)

@Composable
fun XyzwHelperTheme(
  themeMode: ThemeMode,
  content: @Composable () -> Unit,
) {
  val darkTheme = when (themeMode) {
    ThemeMode.LIGHT -> false
    ThemeMode.DARK -> true
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
  }

  MaterialTheme(
    colorScheme = if (darkTheme) DarkColors else LightColors,
    typography = AppTypography,
    content = content,
  )
}
