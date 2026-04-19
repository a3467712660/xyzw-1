package com.xyzw.helper.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.xyzw.helper.data.storage.ThemeMode

private val ColorWhite = Color(0xFFFFFFFF)

private val LightColors = lightColorScheme(
  primary = Blue600,
  onPrimary = ColorWhite,
  primaryContainer = Color(0xFFDCE7FF),
  onPrimaryContainer = Color(0xFF0B2A5F),
  secondary = Teal500,
  onSecondary = ColorWhite,
  secondaryContainer = Color(0xFFD8F3EB),
  onSecondaryContainer = Color(0xFF052E25),
  tertiary = Color(0xFFF97316),
  onTertiary = ColorWhite,
  background = SurfaceLight,
  onBackground = Slate900,
  surface = SurfaceLight,
  onSurface = Slate900,
  surfaceVariant = ColorWhite,
  onSurfaceVariant = Slate700,
  outline = Slate200,
  error = DangerRed,
  errorContainer = Color(0xFFFEE2E2),
  onErrorContainer = Color(0xFF7F1D1D),
)

private val DarkColors = darkColorScheme(
  primary = Blue400,
  onPrimary = Slate950,
  primaryContainer = Color(0xFF1E3A8A),
  onPrimaryContainer = Color(0xFFDBEAFE),
  secondary = Teal300,
  onSecondary = Slate950,
  secondaryContainer = Color(0xFF064E3B),
  onSecondaryContainer = Color(0xFFD1FAE5),
  tertiary = Color(0xFFFDBA74),
  onTertiary = Slate950,
  background = SurfaceDark,
  onBackground = Color(0xFFF8FAFC),
  surface = Color(0xFF172033),
  onSurface = Color(0xFFF8FAFC),
  surfaceVariant = Color(0xFF1F2937),
  onSurfaceVariant = Color(0xFFCBD5E1),
  outline = Color(0xFF475569),
  error = Color(0xFFFCA5A5),
  errorContainer = Color(0xFF7F1D1D),
  onErrorContainer = Color(0xFFFEE2E2),
)

@Composable
fun XyzwTheme(
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
    shapes = AppShapes,
    content = content,
  )
}

@Composable
fun XyzwHelperTheme(
  themeMode: ThemeMode,
  content: @Composable () -> Unit,
) {
  XyzwTheme(themeMode = themeMode, content = content)
}
