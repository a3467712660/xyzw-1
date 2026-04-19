package com.xyzw.helper.ui.formatters

import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

private val displayDateTimeFormatter: DateTimeFormatter =
  DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

fun formatDisplayDateTime(value: String?): String {
  val text = value?.trim().orEmpty()
  if (text.isBlank()) return "--"
  return runCatching {
    OffsetDateTime.parse(text).format(displayDateTimeFormatter)
  }.recoverCatching {
    LocalDateTime.parse(text).format(displayDateTimeFormatter)
  }.getOrElse { text }
}
