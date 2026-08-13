// Derived from a real Sentral .ics export (Aug 2026) — dominant start/end time per period
// across ~30-50 occurrences each. A handful of days (e.g. Wednesday sport afternoons) run
// a different schedule; the "Full Timetable" view uses the actual imported per-date times
// instead of this table, so it isn't affected by these exceptions.
export const BELL_TIMES: Record<string, { start: string; end: string }> = {
  '0':  { start: '08:00', end: '08:50' },
  '1':  { start: '08:50', end: '09:45' },
  '2':  { start: '09:45', end: '10:40' },
  R:    { start: '10:40', end: '11:00' },
  '3':  { start: '11:00', end: '11:55' },
  '4':  { start: '11:55', end: '12:50' },
  L1:   { start: '12:50', end: '13:10' },
  L2:   { start: '13:10', end: '13:30' },
  '5':  { start: '13:30', end: '14:25' },
  '6':  { start: '14:25', end: '15:15' },
}

/** Minutes since midnight, Sydney local time, for a "HH:MM" string. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function nowInSydneyMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Sydney',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export function sydneyWeekday(): number {
  // 0 = Sunday, 6 = Saturday
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', weekday: 'short' }).format(new Date())
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s)
}

export type NextPeriodInfo =
  | { kind: 'in-period'; period: string; minutesLeft: number }
  | { kind: 'before-period'; period: string; minutesUntil: number }
  | { kind: 'after-school' }

/** Given today's periods (ordered), finds what's happening right now relative to the bell schedule. */
export function getNextPeriodInfo(periodCodes: string[]): NextPeriodInfo {
  const nowMin = nowInSydneyMinutes()

  for (const code of periodCodes) {
    const bell = BELL_TIMES[code]
    if (!bell) continue
    const start = toMinutes(bell.start)
    const end = toMinutes(bell.end)
    if (nowMin >= start && nowMin < end) {
      return { kind: 'in-period', period: code, minutesLeft: end - nowMin }
    }
    if (nowMin < start) {
      return { kind: 'before-period', period: code, minutesUntil: start - nowMin }
    }
  }

  return { kind: 'after-school' }
}
