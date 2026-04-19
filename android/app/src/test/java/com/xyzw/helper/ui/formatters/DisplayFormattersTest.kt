package com.xyzw.helper.ui.formatters

import org.junit.Assert.assertEquals
import org.junit.Test

class DisplayFormattersTest {
  @Test
  fun `formatDisplayDateTime renders iso timestamps in 24 hour clock`() {
    assertEquals("2026-04-19 23:05", formatDisplayDateTime("2026-04-19T23:05:30Z"))
    assertEquals("2026-04-19 00:05", formatDisplayDateTime("2026-04-19T00:05:30Z"))
  }

  @Test
  fun `formatDisplayDateTime preserves blank fallback`() {
    assertEquals("--", formatDisplayDateTime(""))
    assertEquals("--", formatDisplayDateTime(null))
  }
}
