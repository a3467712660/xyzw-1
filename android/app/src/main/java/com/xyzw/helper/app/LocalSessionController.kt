package com.xyzw.helper.app

import com.xyzw.helper.data.session.SecureCookieJar
import com.xyzw.helper.data.session.SessionManager
import com.xyzw.helper.data.session.UserSensitiveActionSession

class LocalSessionController(
  private val cookieJar: SecureCookieJar,
  private val sessionManager: SessionManager,
  private val sensitiveActionSession: UserSensitiveActionSession,
) {
  fun clearLocalSession() {
    cookieJar.clear()
    sensitiveActionSession.clear()
    sessionManager.clearSession()
  }
}
