import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncUser } from '@/lib/sentral-sync'

// Triggered by an external scheduler (GitHub Actions, Vercel Cron, etc) — not a browser.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('sentral_sync')
    .select('user_id')
    .eq('status', 'connected')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = await Promise.allSettled((rows ?? []).map(r => syncUser(r.user_id)))

  const summary = results.map((r, i) => ({
    user_id: rows![i].user_id,
    ok: r.status === 'fulfilled' && !r.value.error,
    error: r.status === 'fulfilled' ? r.value.error : String(r.reason),
  }))

  return NextResponse.json({ synced: summary.length, summary })
}
