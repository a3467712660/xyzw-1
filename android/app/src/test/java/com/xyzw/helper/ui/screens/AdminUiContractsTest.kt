package com.xyzw.helper.ui.screens

import com.xyzw.helper.data.model.AuthUser
import com.xyzw.helper.ui.navigation.AppRoute
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminUiContractsTest {
  @Test
  fun `admin entry stays hidden for non admin users`() {
    val hiddenForNull = buildAdminEntrySpec(null)
    val hiddenForNormalUser = buildAdminEntrySpec(
      AuthUser(
        id = "u-1",
        username = "alice",
        isAdmin = false,
      ),
    )

    assertFalse(hiddenForNull.showEntry)
    assertFalse(hiddenForNormalUser.showEntry)
    assertEquals(null, hiddenForNull.route)
    assertEquals(null, hiddenForNormalUser.route)
  }

  @Test
  fun `admin entry is visible for admins and targets admin hub`() {
    val entry = buildAdminEntrySpec(
      AuthUser(
        id = "admin-1",
        username = "root",
        isAdmin = true,
      ),
    )

    assertTrue(entry.showEntry)
    assertEquals(AppRoute.AdminHub.route, entry.route)
  }

  @Test
  fun `task control filters keep repository query shape stable`() {
    val filters = AdminTaskControlLogFilters(
      username = "alice",
      taskName = "daily-cleanup",
      status = "error",
      taskId = "task-1",
      message = "backend timeout",
      limit = 42,
    )

    val query = filters.toQuery()

    assertEquals("alice", query.username)
    assertEquals("daily-cleanup", query.taskName)
    assertEquals("error", query.status)
    assertEquals("task-1", query.taskId)
    assertEquals("backend timeout", query.message)
    assertEquals(42, query.limit)
  }
}
