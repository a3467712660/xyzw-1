package com.xyzw.helper

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.xyzw.helper.app.XyzwHelperApplication
import com.xyzw.helper.ui.navigation.XyzwHelperApp
import com.xyzw.helper.ui.theme.XyzwHelperTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    val container = (application as XyzwHelperApplication).appContainer
    setContent {
      val preferences = container.preferencesStore.preferences.collectAsStateWithLifecycle(
        initialValue = container.initialPreferences,
      )
      XyzwHelperTheme(themeMode = preferences.value.themeMode) {
        XyzwHelperApp(container)
      }
    }
  }
}
