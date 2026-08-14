'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { Period, SchoolNotice } from '@/lib/sentral-parse'
import { sydneyWeekday, getNextPeriodInfo } from '@/lib/bell-times'
import fullTimetableData from '@/lib/imported-timetable.json'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function sydneyDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d) // YYYY-MM-DD
}

const SUBJECT_COLOR: Record<string, string> = {
  'Mathematics':          '#6366f1',
  'English':              '#ec4899',
  'Physics':              '#f59e0b',
  'Chemistry':            '#10b981',
  'Biology':              '#22c55e',
  'Science':              '#14b8a6',
  'History':              '#a855f7',
  'Geography':            '#3b82f6',
  'German':               '#f97316',
  'Enterprise Computing': '#06b6d4',
  'PDHPE':                '#84cc16',
  'Sport':                '#84cc16',
  'Assembly':             '#94a3b8',
  'Lunch':                '#94a3b8',
  'Recess':               '#94a3b8',
}

const subjectColor = (s?: string) => {
  if (!s) return '#6366f1'
  for (const [k, v] of Object.entries(SUBJECT_COLOR)) {
    if (s.toLowerCase().includes(k.toLowerCase())) return v
  }
  return '#6366f1'
}

type SentralRow = {
  status: 'connected' | 'expired'
  timetable: Period[]
  events: SchoolNotice[] // DB column kept as `events` to avoid a schema migration
  last_synced_at: string | null
  last_error: string | null
}

export default function TimetablePage() {
  const { user, session } = useAuth()
  const [row, setRow]                   = useState<SentralRow | null>(null)
  const [rowLoading, setRowLoading]     = useState(true)
  const [cookieInput, setCookieInput]   = useState('')
  const [showSetup, setShowSetup]       = useState(false)
  const [connecting, setConnecting]     = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [isMobile, setIsMobile]         = useState(false)
  const [mounted, setMounted]           = useState(false)
  const [view, setView]                 = useState<'today' | 'full'>('today')
  const [tick, setTick]                 = useState(0)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const loadRow = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('sentral_sync')
      .select('status, timetable, events, last_synced_at, last_error')
      .eq('user_id', user.id)
      .maybeSingle()
    setRow(data as SentralRow | null)
    setRowLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    loadRow()

    // Background cron writes to this row — reflect updates live without polling.
    const channel = supabase
      .channel(`sentral_sync:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sentral_sync', filter: `user_id=eq.${user.id}` },
        () => loadRow()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, loadRow])

  const authedFetch = useCallback((url: string, body?: object) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body ?? {}),
    })
  }, [session])

  const connect = async () => {
    const cleaned = cookieInput.trim()
    if (!cleaned) return
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await authedFetch('/api/sentral/connect', { cookieString: cleaned })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShowSetup(false)
      setCookieInput('')
      await loadRow()
    } catch (e: any) {
      setConnectError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await authedFetch('/api/sentral/sync-now?debug=1')
      const data = await res.json()
      if (data.error) setConnectError(data.error)
      // TEMP DEBUG — remove once the "wrong day" bug is diagnosed.
      console.log('[sentral debug]', data)
      await loadRow()
    } finally {
      setSyncing(false)
    }
  }

  const syncAgo = row?.last_synced_at
    ? Math.round((Date.now() - new Date(row.last_synced_at).getTime()) / 60000)
    : null

  const periods = row?.timetable ?? []
  const notices = row?.events ?? []
  const isWeekend = sydneyWeekday() === 0 || sydneyWeekday() === 6

  const nextPeriodInfo = useMemo(
    () => getNextPeriodInfo(periods.map(p => p.period)),
    [periods, tick] // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!mounted || rowLoading) return null

  /* ── Setup state ─────────────────────────────────────────────────────── */
  if (!row || row.status === 'expired' || showSetup) {
    return (
      <div style={{ padding: isMobile ? '24px 16px' : '40px 40px', maxWidth: 560, margin: '0 auto' }}>
        <p className="page-eyebrow">Sentral</p>
        <h1 className="gradient-text" style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
          {row?.status === 'expired' ? 'Reconnect Sentral' : 'Connect Sentral'}
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
          Paste your Sentral session cookies once — after that, your timetable and events sync automatically in the background.
        </p>

        {row?.status === 'expired' && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#ef4444' }}>
            Your session expired{row.last_error ? ` — ${row.last_error}` : ''}. Paste a fresh cookie to reconnect.
          </div>
        )}

        <div className="glass-card" style={{ padding: 24, borderRadius: 18, marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            How to get your cookies
          </p>
          {[
            'Open Sentral in Chrome and log in',
            'Press F12 (or Cmd+Option+I) to open DevTools',
            'Go to Network tab → click any request → Headers',
            'Find the "cookie:" line under Request Headers',
            'Copy the entire value and paste it below',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent-mid)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{step}</p>
            </div>
          ))}
        </div>

        <textarea
          className="glass-input"
          value={cookieInput}
          onChange={e => setCookieInput(e.target.value)}
          placeholder="PortalSID=...; SID=...; PortalLoggedIn=1"
          rows={4}
          style={{ width: '100%', borderRadius: 12, padding: '12px 14px', fontSize: 12, fontFamily: 'Geist Mono, monospace', resize: 'vertical', marginBottom: 14, boxSizing: 'border-box' }}
        />

        {connectError && (
          <p style={{ fontSize: 12.5, color: '#ef4444', marginBottom: 14 }}>{connectError}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="glass-button"
            onClick={connect}
            disabled={!cookieInput.trim() || connecting}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: cookieInput.trim() && !connecting ? 'pointer' : 'not-allowed', opacity: cookieInput.trim() && !connecting ? 1 : 0.5 }}
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
          {row && row.status !== 'expired' && (
            <button
              className="glass-button"
              onClick={() => setShowSetup(false)}
              style={{ padding: '11px 18px', borderRadius: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.5 }}>
          Cookies are stored server-side against your account and used only to keep your timetable synced automatically. They're never exposed to the browser after this step.
        </p>
      </div>
    )
  }

  /* ── Connected state ─────────────────────────────────────────────────── */
  return (
    <div style={{ padding: isMobile ? '24px 16px' : '40px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="page-eyebrow">Auto Sync · {WEEKDAY_NAMES[sydneyWeekday()]}</p>
          <h1 className="gradient-text" style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Timetable
          </h1>
          {syncAgo !== null && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Synced {syncAgo === 0 ? 'just now' : `${syncAgo}m ago`} · updates automatically
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="glass-button"
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M17 10a7 7 0 11-7-7"/>
              <path d="M17 3v4h-4"/>
            </svg>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            onClick={() => setShowSetup(true)}
            className="glass-button"
            style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Weekend / countdown banner */}
      {isWeekend ? (
        <div className="glass-card" style={{ borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>It's the weekend — no school today</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>The timetable below shows the next school day.</div>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{nextPeriodInfo.kind === 'after-school' ? '🏁' : '⏱'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {nextPeriodInfo.kind === 'in-period' && `${nextPeriodInfo.minutesLeft} min left in Period ${nextPeriodInfo.period}`}
              {nextPeriodInfo.kind === 'before-period' && `Period ${nextPeriodInfo.period} starts in ${nextPeriodInfo.minutesUntil} min`}
              {nextPeriodInfo.kind === 'after-school' && "School's out for the day"}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Based on today's bell times</div>
          </div>
        </div>
      )}

      {connectError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#ef4444' }}>
          {connectError}
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['today', 'full'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="glass-button"
            style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: view === v ? 'var(--accent-soft)' : undefined,
              color: view === v ? 'var(--accent-mid)' : undefined,
            }}
          >
            {v === 'today' ? "Today's Timetable" : 'Full Timetable'}
          </button>
        ))}
      </div>

      {view === 'today' ? (
        /* Main content */
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2.1fr 1fr', gap: 20 }}>

          {/* Timetable */}
          <div className="glass-card" style={{ borderRadius: 18, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Today's Timetable
              </p>
            </div>
            <div style={{ padding: '12px 12px' }}>
              {periods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  No periods found yet
                </div>
              ) : periods.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 11, marginBottom: 4, background: p.isNow ? 'var(--accent-soft)' : 'rgba(0,0,0,0.02)', outline: p.isNow ? '1px solid var(--accent-mid)' : 'none' }}>
                  <div style={{ width: 4, height: 36, borderRadius: 2, background: subjectColor(p.subject), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.subject}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {[p.time, p.room, p.teacher].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {p.period && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: p.isNow ? 'var(--accent-mid)' : 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                      {/^\d+$/.test(p.period) ? `P${p.period}` : p.period}
                      {p.isNow && <div style={{ fontSize: 9.5, letterSpacing: '0.06em', marginTop: 1 }}>NOW</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* School notices */}
          <div className="glass-card" style={{ borderRadius: 18, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                School Notices
              </p>
            </div>
            <div style={{ padding: '12px 12px' }}>
              {notices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  No notices found yet
                </div>
              ) : notices.map((n, i) => (
                <div key={i} style={{ padding: '10px 10px', borderRadius: 11, marginBottom: 4, background: 'rgba(0,0,0,0.02)' }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {n.title}
                  </div>
                  {(n.date || n.sender) && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                      {[n.date, n.sender].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <FullTimetable />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ── Full Timetable (imported reference schedule) ────────────────────────── */
type ImportedEntry = {
  date: string
  period: string
  start: string
  end: string
  subject: string
  className: string
  room: string
  teacher: string
}

function FullTimetable() {
  const todayKey = sydneyDateKey()
  const grouped = useMemo(() => {
    const byDate = new Map<string, ImportedEntry[]>()
    for (const e of fullTimetableData as ImportedEntry[]) {
      if (!byDate.has(e.date)) byDate.set(e.date, [])
      byDate.get(e.date)!.push(e)
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [])

  const firstDate = grouped[0]?.[0]
  const lastDate = grouped[grouped.length - 1]?.[0]

  return (
    <div className="glass-card" style={{ borderRadius: 18, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Full Timetable
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
          Imported reference schedule · {firstDate} to {lastDate}
        </p>
      </div>
      <div style={{ padding: '12px 12px', maxHeight: 640, overflowY: 'auto' }}>
        {grouped.map(([date, entries]) => {
          const isToday = date === todayKey
          const weekday = new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long' })
          const niceDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, marginBottom: 6, padding: '4px 8px', borderRadius: 8, display: 'inline-block',
                color: isToday ? 'var(--accent-mid)' : 'var(--text-secondary)',
                background: isToday ? 'var(--accent-soft)' : 'transparent',
              }}>
                {weekday} {niceDate}{isToday ? ' · Today' : ''}
              </div>
              {entries.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10, marginBottom: 3, background: 'rgba(0,0,0,0.02)' }}>
                  <div style={{ width: 4, height: 30, borderRadius: 2, background: subjectColor(e.subject), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.subject}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {[`${e.start}–${e.end}`, e.room, e.teacher].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    P{e.period}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
