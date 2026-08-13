const SCHOOL_BASE = 'https://northsydbo-h.sentral.com.au/s-OqWE2e/portal'
const STUDENT_ID = '2419'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

type FetchResult<T> =
  | { data: T; expired?: undefined; error?: undefined }
  | { expired: true; data?: undefined; error?: undefined }
  | { error: string; data?: undefined; expired?: undefined }

async function sentralFetch<T>(url: string, cookieString: string, init?: RequestInit): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        cookie:            cookieString,
        'User-Agent':      UA,
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-AU,en;q=0.9',
        'Referer':         `${SCHOOL_BASE}/`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      redirect: 'manual', // expired sessions 302 to the login page — surface that instead of following it
    })

    // `redirect: 'manual'` yields an opaqueredirect response (status 0) when a redirect would occur
    if (res.type === 'opaqueredirect' || res.status === 302 || res.status === 401) {
      return { expired: true }
    }
    if (!res.ok) {
      return { error: `Sentral returned ${res.status}` }
    }

    return { data: (await res.json()) as T }
  } catch (err: any) {
    return { error: err.message ?? 'Network error' }
  }
}

export type RawLesson = {
  subject_name: string
  lesson_class_name: string
  room_name: string
  teachers: string[]
  lesson_is_composite: boolean
}

export type RawPeriod = {
  is_today: boolean
  is_now: boolean
  timetable_period_name: string
  lessons: RawLesson[]
}

export function fetchTimetable(cookieString: string) {
  return sentralFetch<RawPeriod[]>(`${SCHOOL_BASE}/timetable/getDailyTimetable/${STUDENT_ID}`, cookieString)
}

export function fetchEvents(cookieString: string) {
  return sentralFetch<any[]>(`${SCHOOL_BASE}/feed`, cookieString, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      action: 'student',
      student_id: Number(STUDENT_ID),
      status_filter: 'active',
      feed_item_count: 0,
      start_date: `${new Date().getFullYear()}-01-01`,
      keywords: '',
    }),
  })
}
