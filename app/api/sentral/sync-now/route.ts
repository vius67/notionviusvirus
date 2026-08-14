import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/get-user-from-request'
import { syncUser } from '@/lib/sentral-sync'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchTimetable } from '@/lib/sentral'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await syncUser(user.id)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    // TEMP DEBUG — remove once the "wrong day" bug is diagnosed.
    let debugRaw: unknown = null
    const debugFlag = req.nextUrl.searchParams.get('debug')
    if (debugFlag) {
      try {
        const { data: row, error: rowError } = await getSupabaseAdmin()
          .from('sentral_sync')
          .select('cookie_string')
          .eq('user_id', user.id)
          .maybeSingle()
        if (rowError) {
          debugRaw = { debugError: `row lookup: ${rowError.message}` }
        } else if (!row?.cookie_string) {
          debugRaw = { debugError: 'no cookie_string on row' }
        } else {
          debugRaw = await fetchTimetable(row.cookie_string)
        }
      } catch (err: any) {
        debugRaw = { debugError: err?.message ?? String(err), debugStack: err?.stack }
      }
    }

    return NextResponse.json({ ok: true, timetable: result.timetable, events: result.notices, debugRaw })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error', stack: err?.stack }, { status: 500 })
  }
}
