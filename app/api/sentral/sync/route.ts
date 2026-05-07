import { NextRequest, NextResponse } from 'next/server'

const SCHOOL_BASE = 'https://northsydbo-h.sentral.com.au/s-OqWE2e/portal'
const STUDENT_ID  = '2419'

const ENDPOINTS: Record<string, string> = {
  timetable: `${SCHOOL_BASE}/_partials/student/timetable.html`,
  events:    `${SCHOOL_BASE}/_partials/dashboard/upcoming_events.html`,
  feed:      `${SCHOOL_BASE}/feed`,
  student:   `${SCHOOL_BASE}/user?action=get_student_info&student_id=${STUDENT_ID}`,
}

export async function POST(req: NextRequest) {
  try {
    const { cookieString, type } = await req.json()
    if (!cookieString) return NextResponse.json({ error: 'No cookie string provided' }, { status: 400 })

    const url = ENDPOINTS[type]
    if (!url) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

    const res = await fetch(url, {
      headers: {
        cookie:            cookieString,
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
        'Referer':         'https://northsydbo-h.sentral.com.au/',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Sentral returned ${res.status}` }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    const data = isJson ? await res.json() : await res.text()

    return NextResponse.json({ data, isJson, fetchedAt: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Network error' }, { status: 500 })
  }
}
