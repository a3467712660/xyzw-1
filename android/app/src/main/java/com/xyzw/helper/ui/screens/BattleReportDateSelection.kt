package com.xyzw.helper.ui.screens

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

private val battleReportDateFormatter = DateTimeFormatter.ofPattern("yyyy/MM/dd")

fun isDateBackedBattleReportType(reportType: String): Boolean =
  reportType != "manual"

fun defaultBattleReportDate(
  reportType: String = "salt-field",
  now: LocalDateTime = LocalDateTime.now(),
): String {
  val targetDate = when (reportType) {
    "peach-garden" -> defaultPeachGardenDate(now)
    else -> defaultSaltFieldDate(now)
  }
  return targetDate.format(battleReportDateFormatter)
}

fun isSelectableBattleReportDate(
  reportType: String,
  date: LocalDate,
  today: LocalDate = LocalDate.now(),
): Boolean {
  if (date.isAfter(today)) return false
  return when (reportType) {
    "peach-garden" -> date.dayOfWeek == DayOfWeek.SUNDAY
    "manual" -> false
    else -> date.dayOfWeek == DayOfWeek.SATURDAY || isFourthSunday(date)
  }
}

fun parseBattleReportDate(value: String): LocalDate? =
  runCatching { LocalDate.parse(value.trim(), battleReportDateFormatter) }.getOrNull()

fun battleReportDateToUtcMillis(value: String): Long? =
  parseBattleReportDate(value)?.toUtcMillis()

fun battleReportDateFromUtcMillis(millis: Long): String =
  Instant.ofEpochMilli(millis)
    .atZone(ZoneOffset.UTC)
    .toLocalDate()
    .format(battleReportDateFormatter)

fun battleReportDateFromUtcMillisToLocalDate(millis: Long): LocalDate =
  Instant.ofEpochMilli(millis)
    .atZone(ZoneOffset.UTC)
    .toLocalDate()

private fun defaultSaltFieldDate(now: LocalDateTime): LocalDate {
  val today = now.toLocalDate()
  return when (today.dayOfWeek) {
    DayOfWeek.SATURDAY -> today
    DayOfWeek.SUNDAY -> if (isFourthSunday(today)) today else today.minusDays(1)
    else -> today.minusDays(today.dayOfWeek.value.toLong() + 1L)
  }
}

private fun defaultPeachGardenDate(now: LocalDateTime): LocalDate {
  val today = now.toLocalDate()
  return if (today.dayOfWeek == DayOfWeek.SUNDAY) {
    if (now.hour < 18) today.minusDays(7) else today
  } else {
    today.minusDays(today.dayOfWeek.value.toLong())
  }
}

private fun isFourthSunday(date: LocalDate): Boolean {
  if (date.dayOfWeek != DayOfWeek.SUNDAY) return false
  val firstDay = date.withDayOfMonth(1)
  val daysUntilSunday = (DayOfWeek.SUNDAY.value - firstDay.dayOfWeek.value + 7) % 7
  val firstSunday = firstDay.plusDays(daysUntilSunday.toLong())
  return date == firstSunday.plusWeeks(3)
}

private fun LocalDate.toUtcMillis(): Long =
  atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
