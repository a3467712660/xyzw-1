package com.xyzw.helper.app

import android.app.Application

class XyzwHelperApplication : Application() {
  val appContainer: AppContainer by lazy {
    AppContainer(this)
  }
}
