package com.xyzw.helper.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class BattleReportDateSelectionTest {
  @Test
  fun `salt field default date follows web last saturday rule`() {
    assertEquals(
      "2026/04/18",
      defaultBattleReportDate("salt-field", LocalDateTime.of(2026, 4, 19, 12, 0)),
    )
    assertEquals(
      "2026/04/26",
      defaultBattleReportDate("salt-field", LocalDateTime.of(2026, 4, 26, 12, 0)),
    )
  }

  @Test
  fun `peach garden default date follows web sunday evening rule`() {
    assertEquals(
      "2026/04/12",
      defaultBattleReportDate("peach-garden", LocalDateTime.of(2026, 4, 19, 17, 59)),
    )
    assertEquals(
      "2026/04/19",
      defaultBattleReportDate("peach-garden", LocalDateTime.of(2026, 4, 19, 18, 0)),
    )
  }

  @Test
  fun `date picker only allows valid completed report dates`() {
    val today = LocalDate.of(2026, 4, 19)

    assertTrue(isSelectableBattleReportDate("salt-field", LocalDate.of(2026, 4, 18), today))
    assertFalse(isSelectableBattleReportDate("salt-field", LocalDate.of(2026, 4, 15), today))
    assertFalse(isSelectableBattleReportDate("salt-field", LocalDate.of(2026, 4, 25), today))

    assertTrue(isSelectableBattleReportDate("peach-garden", LocalDate.of(2026, 4, 12), today))
    assertFalse(isSelectableBattleReportDate("peach-garden", LocalDate.of(2026, 4, 18), today))
    assertFalse(isSelectableBattleReportDate("peach-garden", LocalDate.of(2026, 4, 26), today))
  }
}
