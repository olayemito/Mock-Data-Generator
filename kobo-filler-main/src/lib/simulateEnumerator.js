export function simulateEnumerator(rows, enumerators, days, startDate) {
  if (!rows || rows.length === 0) return rows

  const enumeratorCount = Math.max(1, enumerators || 3)
  const dayCount        = Math.max(1, days || 3)

  // Parse date parts manually to avoid UTC vs local timezone issues.
  // new Date("2024-01-15") is UTC midnight which shifts the date in non-UTC zones.
  let startYear, startMonth, startDay
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    ;[startYear, startMonth, startDay] = startDate.split("-").map(Number)
  } else {
    const now = new Date()
    startYear  = now.getFullYear()
    startMonth = now.getMonth() + 1
    startDay   = now.getDate()
  }

  // Build start as local 8am on the chosen date
  const start = new Date(startYear, startMonth - 1, startDay, 8, 0, 0, 0)

  const msPerDay       = 24 * 60 * 60 * 1000
  const workingHoursMs =  8 * 60 * 60 * 1000 // 8-hour working day

  return rows.map((r, i) => {
    const dayIndex   = Math.floor((i / rows.length) * dayCount)
    const rowsPerDay = Math.ceil(rows.length / dayCount)
    const indexInDay = i % rowsPerDay
    const timeWithinDay = rowsPerDay > 1
      ? (indexInDay / (rowsPerDay - 1)) * workingHoursMs
      : 0

    const submissionTime = new Date(start.getTime() + dayIndex * msPerDay + timeWithinDay)

    return {
      ...r,
      _enumerator:      `ENUM_${i % enumeratorCount}`,
      _submission_time: submissionTime.toISOString(),
    }
  })
}
