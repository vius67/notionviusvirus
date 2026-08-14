import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/get-user-from-request'
import { syncUser } from '@/lib/sentral-sync'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await syncUser(user.id)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    // TEMP DEBUG — remove once the "wrong day" bug is diagnosed. Reuses the raw
    // response syncUser already fetched instead of making a second live call
    // (that extra call is what blew the function past its timeout last time).
    return NextResponse.json({ ok: true, timetable: result.timetable, events: result.notices, debugRaw: result.raw })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error', stack: err?.stack }, { status: 500 })
  }
}
