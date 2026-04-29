import { NextResponse } from 'next/server'

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN

// Google's named event colors → hex
const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d60000',
}

async function getAccessToken(): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string }
  return data.access_token ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(item: any, calColor: string) {
  const isAllDay = !!item.start?.date && !item.start?.dateTime
  const start    = item.start?.dateTime ?? item.start?.date ?? null
  const end      = item.end?.dateTime   ?? item.end?.date   ?? null
  if (!start) return null

  const color = item.colorId ? (GOOGLE_COLORS[item.colorId] ?? calColor) : calColor

  return {
    id:          `google-${item.id}`,
    title:       item.summary ?? '(No title)',
    description: item.description ?? null,
    start_time:  start  as string,
    end_time:    end    as string | null,
    color,
    source:      'google' as const,
    url:         item.htmlLink as string,
    allDay:      isAllDay,
  }
}

export async function GET() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return NextResponse.json({ events: [], configured: false })
  }

  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ events: [], configured: true, error: 'token_refresh_failed' })
    }

    const headers = { Authorization: `Bearer ${accessToken}` }

    // 1. Get all calendars the user has
    const calListRes  = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50', { headers })
    const calListData = await calListRes.json() as { items?: { id: string; backgroundColor?: string; selected?: boolean }[] }
    const calendars   = (calListData.items ?? []).filter(c => c.selected !== false)

    // 2. Fetch events from each calendar in parallel (~3 months back, 6 months ahead)
    const timeMin = new Date(); timeMin.setMonth(timeMin.getMonth() - 3)
    const timeMax = new Date(); timeMax.setMonth(timeMax.getMonth() + 6)

    const results = await Promise.all(
      calendars.map(async cal => {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`)
        url.searchParams.set('timeMin',      timeMin.toISOString())
        url.searchParams.set('timeMax',      timeMax.toISOString())
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy',      'startTime')
        url.searchParams.set('maxResults',   '250')

        const res = await fetch(url.toString(), { headers, next: { revalidate: 60 } })
        if (!res.ok) return []
        const data = await res.json() as { items?: unknown[] }
        const calColor = cal.backgroundColor ?? '#3b82f6'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data.items ?? []).flatMap((item: any) => {
          const ev = mapItem(item, calColor)
          return ev ? [ev] : []
        })
      })
    )

    const events = results.flat()
    return NextResponse.json({ events, configured: true })
  } catch (err) {
    console.error('[google/events]', err)
    return NextResponse.json({ events: [], configured: true, error: String(err) })
  }
}
