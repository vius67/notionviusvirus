'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

const COOKIE_KEY = 'sentral_cookies'

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

type Period = {
  period: string
  time: string
  subject: string
  room: string
  teacher: string
  day?: string
}

type UpcomingEvent = {
  title: string
  date: string
  subject: string
  type: string
}

/* ── Parse Sentral timetable HTML ────────────────────────────────────────── */
function parseTimetable(html: string): Period[] {
  if (typeof window === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const periods: Period[] = []

  // Sentral typically renders a table — grab every <tr> with at least 3 <td>s
  const rows = Array.from(doc.querySelectorAll('tr'))
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td')).map(c => c.textContent?.trim() ?? '')
    if (cells.length < 3) continue
    // Skip header-like rows
    if (!cells.some(c => c.length > 1)) continue

    // Heuristic: try to find time (contains ':')
    const timeCell   = cells.find(c => /\d:\d/.test(c)) ?? ''
    const subjectIdx = timeCell ? cells.indexOf(timeCell) + 1 : 1
    const subject    = cells[subjectIdx] ?? cells[1] ?? ''
    const room       = cells.find(c => /^[A-Z]\d{1,3}$|room/i.test(c) && c !== subject) ?? ''
    const teacher    = cells.find(c =>
      c.includes(' ') && c !== subject && c !== room && c !== timeCell && c.length > 3
    ) ?? ''

    if (!subject || subject.toLowerCase() === 'subject') continue

    periods.push({
      period:  cells[0],
      time:    timeCell,
      subject,
      room,
      teacher,
    })
  }

  // If table parsing got nothing, try div-based layout
  if (periods.length === 0) {
    const blocks = doc.querySelectorAll('[class*="period"], [class*="lesson"], [class*="class"]')
    blocks.forEach(b => {
      const text = b.textContent?.trim() ?? ''
      if (!text) return
      periods.push({
        period:  '',
        time:    '',
        subject: text.split('\n')[0].trim(),
        room:    '',
        teacher: '',
      })
    })
  }

  return periods
}

/* ── Parse upcoming events HTML ──────────────────────────────────────────── */
function parseEvents(html: string): UpcomingEvent[] {
  if (typeof window === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const events: UpcomingEvent[] = []

  // Try rows / list items / cards
  const candidates = Array.from(
    doc.querySelectorAll('tr, li, [class*="event"], [class*="item"], [class*="row"]')
  )

  for (const el of candidates) {
    const text = el.textContent?.trim() ?? ''
    if (!text || text.length < 4) continue

    const lines = text.split(/\n|  +/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    // Find a date pattern
    const dateMatch = text.match(
      /\b(\d{1,2}[\s\/-]\w+[\s\/-]?\d{0,4}|\w+ \d{1,2},?\s*\d{0,4}|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^\n]*/i
    )

    const titleEl = el.querySelector('[class*="title"],[class*="name"],strong,b,h1,h2,h3,h4,h5')
    const title   = titleEl?.textContent?.trim() ?? lines[0]

    if (!title || title.length < 3) continue
    // Skip pure navigation / header rows
    if (['event', 'date', 'subject', 'type', 'title'].includes(title.toLowerCase())) continue

    events.push({
      title,
      date:    dateMatch?.[0]?.trim() ?? '',
      subject: '',
      type:    '',
    })
  }

  // Deduplicate by title
  const seen = new Set<string>()
  return events.filter(e => {
    if (seen.has(e.title)) return false
    seen.add(e.title)
    return true
  }).slice(0, 20)
}

/* ────────────────────────────────────────────────────────────────────────── */
export default function TimetablePage() {
  const { user } = useAuth()
  const [cookies, setCookies]           = useState<string | null>(null)
  const [cookieInput, setCookieInput]   = useState('')
  const [showSetup, setShowSetup]       = useState(false)
  const [periods, setPeriods]           = useState<Period[]>([])
  const [events, setEvents]             = useState<UpcomingEvent[]>([])
  const [rawTT, setRawTT]               = useState('')
  const [rawEv, setRawEv]               = useState('')
  const [syncing, setSyncing]           = useState(false)
  const [lastSync, setLastSync]         = useState<Date | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [debug, setDebug]               = useState(false)
  const [isMobile, setIsMobile]         = useState(false)
  const [mounted, setMounted]           = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(COOKIE_KEY)
    if (stored) setCookies(stored)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sync = useCallback(async (cookieStr: string) => {
    setSyncing(true)
    setError(null)
    try {
      const [ttRes, evRes] = await Promise.all([
        fetch('/api/sentral/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookieString: cookieStr, type: 'timetable' }),
        }),
        fetch('/api/sentral/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookieString: cookieStr, type: 'events' }),
        }),
      ])

      const [ttData, evData] = await Promise.all([ttRes.json(), evRes.json()])

      if (ttData.error) throw new Error(ttData.error)

      if (ttData.data) {
        const html = ttData.isJson ? JSON.stringify(ttData.data, null, 2) : ttData.data
        setRawTT(html)
        if (!ttData.isJson) setPeriods(parseTimetable(html))
      }
      if (evData.data) {
        const html = evData.isJson ? JSON.stringify(evData.data, null, 2) : evData.data
        setRawEv(html)
        if (!evData.isJson) setEvents(parseEvents(html))
      }

      setLastSync(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (cookies) sync(cookies)
  }, [cookies]) // eslint-disable-line

  const saveCookies = () => {
    const cleaned = cookieInput.trim()
    if (!cleaned) return
    localStorage.setItem(COOKIE_KEY, cleaned)
    setCookies(cleaned)
    setShowSetup(false)
    setCookieInput('')
  }

  const disconnectSentral = () => {
    localStorage.removeItem(COOKIE_KEY)
    setCookies(null)
    setPeriods([])
    setEvents([])
    setRawTT('')
    setRawEv('')
    setLastSync(null)
  }

  const syncAgo = lastSync
    ? Math.round((Date.now() - lastSync.getTime()) / 60000)
    : null

  if (!mounted) return null

  /* ── Setup state ─────────────────────────────────────────────────────── */
  if (!cookies || showSetup) {
    return (
      <div style={{ padding: isMobile ? '24px 16px' : '40px 40px', maxWidth: 560, margin: '0 auto' }}>
        <p className="page-eyebrow">Sentral</p>
        <h1 className="gradient-text" style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Connect Sentral
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
          Paste your Sentral session cookies to sync your timetable and upcoming events live.
        </p>

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

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="glass-button"
            onClick={saveCookies}
            disabled={!cookieInput.trim()}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: cookieInput.trim() ? 'pointer' : 'not-allowed', opacity: cookieInput.trim() ? 1 : 0.5 }}
          >
            Connect
          </button>
          {cookies && (
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
          Cookies are stored locally in your browser and never sent to any third-party server. They expire when your Sentral session expires.
        </p>
      </div>
    )
  }

  /* ── Connected state ─────────────────────────────────────────────────── */
  return (
    <div style={{ padding: isMobile ? '24px 16px' : '40px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="page-eyebrow">Live Sync</p>
          <h1 className="gradient-text" style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Timetable
          </h1>
          {syncAgo !== null && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Synced {syncAgo === 0 ? 'just now' : `${syncAgo}m ago`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => sync(cookies)}
            disabled={syncing}
            className="glass-button"
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M17 10a7 7 0 11-7-7"/>
              <path d="M17 3v4h-4"/>
            </svg>
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={() => setDebug(d => !d)}
            className="glass-button"
            style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, cursor: 'pointer', opacity: debug ? 1 : 0.6 }}
          >
            {debug ? 'Hide raw' : 'Raw HTML'}
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

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#ef4444' }}>
          {error} — your cookies may have expired. <button onClick={() => setShowSetup(true)} style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>Update cookies</button>
        </div>
      )}

      {/* Debug panel */}
      {debug && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {[['Timetable HTML', rawTT], ['Events HTML', rawEv]].map(([label, raw]) => (
            <div key={label} className="glass-card" style={{ borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</p>
              <pre style={{ fontSize: 10, overflow: 'auto', maxHeight: 300, margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'Geist Mono, monospace' }}>
                {raw || '(empty)'}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>

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
                {syncing ? 'Loading timetable…' : 'No periods found — check Raw HTML to debug'}
              </div>
            ) : periods.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 11, marginBottom: 4, background: 'rgba(0,0,0,0.02)' }}>
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    P{p.period}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="glass-card" style={{ borderRadius: 18, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Upcoming Events
            </p>
          </div>
          <div style={{ padding: '12px 12px' }}>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                {syncing ? 'Loading events…' : 'No events found — check Raw HTML to debug'}
              </div>
            ) : events.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 10px', borderRadius: 11, marginBottom: 4, background: 'rgba(0,0,0,0.02)' }}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: subjectColor(e.subject || e.title), flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {e.title}
                  </div>
                  {e.date && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {e.date}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Disconnect */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          onClick={disconnectSentral}
          style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Disconnect Sentral
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
