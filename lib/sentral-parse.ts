import type { RawPeriod } from './sentral'
import { BELL_TIMES } from './bell-times'

export type Period = {
  period: string
  time: string
  subject: string
  room: string
  teacher: string
  isNow: boolean
}

export type SchoolNotice = {
  title: string
  date: string
  sender: string
}

// Break/admin periods have no lessons — Sentral identifies them only by period code.
const BREAK_LABELS: Record<string, string> = {
  R:  'Recess',
  L1: 'Lunch',
  L2: 'Lunch',
  AS: 'Assembly',
}

export function mapTimetable(raw: RawPeriod[]): Period[] {
  const periods: Period[] = []

  for (const p of (raw ?? []).filter(p => p.is_today)) {
    const bell = BELL_TIMES[p.timetable_period_name]
    const time = bell ? `${bell.start}–${bell.end}` : ''

    if (p.lessons.length > 0) {
      for (const lesson of p.lessons) {
        periods.push({
          period:  p.timetable_period_name,
          time,
          subject: lesson.subject_name,
          room:    lesson.room_name ?? '',
          teacher: (lesson.teachers ?? []).join(', '),
          isNow:   p.is_now,
        })
      }
    } else if (BREAK_LABELS[p.timetable_period_name]) {
      periods.push({
        period:  p.timetable_period_name,
        time,
        subject: BREAK_LABELS[p.timetable_period_name],
        room:    '',
        teacher: '',
        isNow:   p.is_now,
      })
    }
  }

  return periods
}

// /feed returns school-wide notices/announcements, not a personal calendar of due dates.
export function mapNotices(raw: any[]): SchoolNotice[] {
  return (raw ?? []).map(item => ({
    title:  item.header ?? 'Untitled notice',
    date:   formatFeedDate(item.publish_after ?? item.created),
    sender: item.sender ?? '',
  }))
}

function formatFeedDate(raw?: string): string {
  if (!raw) return ''
  const datePart = raw.split(' ')[0] // "2026-05-20 09:15:40" -> "2026-05-20"
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
