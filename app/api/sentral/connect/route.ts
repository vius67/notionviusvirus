import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/get-user-from-request'
import { syncUser } from '@/lib/sentral-sync'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cookieString } = await req.json()
  if (!cookieString) return NextResponse.json({ error: 'No cookie string provided' }, { status: 400 })

  const result = await syncUser(user.id, cookieString)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true, timetable: result.timetable, events: result.notices })
}
