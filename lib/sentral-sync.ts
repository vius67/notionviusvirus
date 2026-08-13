import { supabaseAdmin } from './supabase-admin'
import { fetchTimetable, fetchEvents } from './sentral'
import { mapTimetable, mapNotices, type Period, type SchoolNotice } from './sentral-parse'

type SyncResult =
  | { timetable: Period[]; notices: SchoolNotice[]; error?: undefined }
  | { error: string; timetable?: undefined; notices?: undefined }

/** Syncs one user's timetable/events using their cached cookie (or a freshly-provided one) and writes the result to Supabase. */
export async function syncUser(userId: string, cookieOverride?: string): Promise<SyncResult> {
  let cookie = cookieOverride
  if (!cookie) {
    const { data } = await supabaseAdmin
      .from('sentral_sync')
      .select('cookie_string')
      .eq('user_id', userId)
      .maybeSingle()
    cookie = data?.cookie_string
  }
  if (!cookie) return { error: 'Not connected' }

  const [tt, ev] = await Promise.all([
    fetchTimetable(cookie),
    fetchEvents(cookie),
  ])

  if (tt.expired || ev.expired) {
    await supabaseAdmin.from('sentral_sync').upsert({
      user_id: userId,
      cookie_string: cookie,
      status: 'expired',
      last_error: 'Session expired — reconnect with a fresh cookie',
      updated_at: new Date().toISOString(),
    })
    return { error: 'Session expired' }
  }

  if (tt.error || ev.error) {
    const message = tt.error ?? ev.error!
    await supabaseAdmin.from('sentral_sync').upsert({
      user_id: userId,
      cookie_string: cookie,
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    return { error: message }
  }

  const timetable = mapTimetable(tt.data!)
  const notices = mapNotices(ev.data!)

  await supabaseAdmin.from('sentral_sync').upsert({
    user_id: userId,
    cookie_string: cookie,
    status: 'connected',
    timetable,
    events: notices, // DB column kept as `events` to avoid a schema migration
    last_synced_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  })

  return { timetable, notices }
}
