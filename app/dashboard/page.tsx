'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────
type Checkin = {
  id: string
  date: string
  maths:   boolean
  ucat:    boolean
  science: boolean
  kurt:    boolean
  beam:    boolean
}
type CheckinKey = keyof Omit<Checkin, 'id' | 'date'>

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0]

const ITEMS: { key: CheckinKey; label: string; sub: string; time: string; color: string }[] = [
  { key: 'maths',   label: '1h Maths',    sub: 'Polynomials · Graphs · Functions · Algebra mastery', time: '1h',  color: '#6366f1' },
  { key: 'ucat',    label: '15m UCAT',    sub: 'UCAT practice & preparation',                          time: '15m', color: '#8b5cf6' },
  { key: 'science', label: '30m Science', sub: 'Science study session',                                time: '30m', color: '#14b8a6' },
  { key: 'kurt',    label: '30m Kurt',    sub: 'Kurt tutoring centre work',                            time: '30m', color: '#a855f7' },
  { key: 'beam',    label: '30m BEAM',    sub: 'BEAM study session',                                   time: '30m', color: '#f59e0b' },
]

const countDone = (c: Checkin | null) =>
  c ? ITEMS.filter(i => c[i.key]).length : 0

const calcStreak = (checkins: Checkin[]): number => {
  const byDate = new Map(checkins.map(c => [c.date, c]))
  let streak = 0
  const d = new Date()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ds = d.toISOString().split('T')[0]
    const c = byDate.get(ds)
    if (!c || countDone(c) === 0) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Dashboard page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()

  // existing stats
  const [stats, setStats]       = useState({ hw: 0, hwDone: 0, todos: 0, todosDone: 0, papers: 0, studyMins: 0 })
  const [upcomingHW, setUpcomingHW]   = useState<any[]>([])
  const [recentTodos, setRecentTodos] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [countdown, setCountdown]     = useState({ d: 0, h: 0, m: 0, s: 0 })
  const tickRef = useRef<NodeJS.Timeout | null>(null)

  // daily check-in
  const [checkins, setCheckins]       = useState<Checkin[]>([])
  const [todayCI, setTodayCI]         = useState<Checkin | null>(null)
  const [savingCI, setSavingCI]       = useState<CheckinKey | null>(null)
  const [ciLoading, setCiLoading]     = useState(true)
  const [isMobile, setIsMobile]       = useState(false)
  const [animPct, setAnimPct]         = useState(0)
  const animRafRef   = useRef<number | null>(null)
  const animStartRef = useRef<number | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [hw, todos, papers] = await Promise.all([
        supabase.from('homework').select('*').eq('user_id', user.id),
        supabase.from('todos').select('*').eq('user_id', user.id),
        supabase.from('past_papers').select('id').eq('user_id', user.id),
      ])
      const hwData    = hw.data    || []
      const todosData = todos.data || []
      setStats({ hw: hwData.length, hwDone: hwData.filter((h: any) => h.completed).length, todos: todosData.length, todosDone: todosData.filter((t: any) => t.completed).length, papers: (papers.data || []).length, studyMins: 0 })
      const sorted = hwData.filter((h: any) => !h.completed && h.due_date).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      setUpcomingHW(sorted.slice(0, 6))
      setRecentTodos(todosData.filter((t: any) => !t.completed).slice(0, 4))
      setLoading(false)
    })()
  }, [user])

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Count-up animation — fires once when data finishes loading
  useEffect(() => {
    if (loading) return
    animStartRef.current = null
    const duration = 1100
    const ease = (t: number) => 1 - Math.pow(1 - t, 4)
    const run = (ts: number) => {
      if (!animStartRef.current) animStartRef.current = ts
      const t = Math.min((ts - animStartRef.current) / duration, 1)
      setAnimPct(ease(t))
      if (t < 1) animRafRef.current = requestAnimationFrame(run)
    }
    animRafRef.current = requestAnimationFrame(run)
    return () => { if (animRafRef.current) cancelAnimationFrame(animRafRef.current) }
  }, [loading])

  // load check-ins (last 35 days)
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const since = new Date()
      since.setDate(since.getDate() - 35)
      const { data } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', since.toISOString().split('T')[0])
        .order('date', { ascending: false })
      const rows = (data || []) as Checkin[]
      setCheckins(rows)
      setTodayCI(rows.find(c => c.date === TODAY) || null)
      setCiLoading(false)
    })()
  }, [user])

  // ── Toggle a check-in item ─────────────────────────────────────────────────
  const toggleItem = async (key: CheckinKey) => {
    if (!user || savingCI) return
    setSavingCI(key)
    const newVal = !todayCI?.[key]

    // optimistic update
    const optimistic: Checkin = todayCI
      ? { ...todayCI, [key]: newVal }
      : { id: '', date: TODAY, maths: false, ucat: false, science: false, kurt: false, beam: false, [key]: newVal }
    setTodayCI(optimistic)
    setCheckins(prev => {
      const without = prev.filter(c => c.date !== TODAY)
      return [optimistic, ...without]
    })

    if (todayCI?.id) {
      await supabase.from('daily_checkins').update({ [key]: newVal }).eq('id', todayCI.id)
    } else {
      const { data } = await supabase.from('daily_checkins').insert({
        user_id: user.id, date: TODAY,
        maths: false, ucat: false, science: false, kurt: false, beam: false, [key]: newVal,
      }).select().single()
      if (data) {
        setTodayCI(data as Checkin)
        setCheckins(prev => [data as Checkin, ...prev.filter(c => c.date !== TODAY)])
      }
    }
    setSavingCI(null)
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  const nextHW = upcomingHW[0] ?? null
  useEffect(() => {
    if (!nextHW?.due_date) return
    const tick = () => {
      const target = new Date(nextHW.due_date + 'T23:59:59').getTime()
      const diff = Math.max(0, target - Date.now())
      setCountdown({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) })
    }
    tick()
    tickRef.current = setInterval(tick, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [nextHW?.due_date])

  // ── Derived ──────────────────────────────────────────────────────────────
  const hour     = new Date().getHours()
  const greeting = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetingEmoji = hour < 5 ? '🌙' : hour < 12 ? '☀️' : hour < 17 ? '👋' : '🌆'
  const name     = user?.email?.split('@')[0] || 'student'

  const getDueLabel = (due: string) => {
    const diff = Math.ceil((new Date(due + 'T00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (diff === 0) return { label: 'Today',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' }
    return { label: `${diff}d`, color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.08)' }
  }

  const hwPct   = stats.hw   > 0 ? Math.round((stats.hwDone   / stats.hw)   * 100) : 0
  const todoPct = stats.todos > 0 ? Math.round((stats.todosDone / stats.todos) * 100) : 0
  const todayDone = countDone(todayCI)
  const todayPct  = Math.round((todayDone / 5) * 100)
  const streak    = calcStreak(checkins)

  const STAT_CARDS = [
    { label: 'Homework', href: '/dashboard/homework', pct: hwPct, done: Math.round(stats.hwDone * animPct), total: stats.hw, gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', bar: 'linear-gradient(90deg, #6366f1, #a78bfa)', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h9a2 2 0 012 2v11a2 2 0 01-2 2H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M15 14h1a1 1 0 000-2h-1"/><path d="M7 7h5M7 10h5M7 13h3"/></svg> },
    { label: 'To-do',    href: '/dashboard/todos',    pct: todoPct, done: Math.round(stats.todosDone * animPct), total: stats.todos, gradient: 'linear-gradient(135deg, #a78bfa, #f87171)', bar: 'linear-gradient(90deg, #a78bfa, #f87171)', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="3.5"/><path d="M7 10l2.5 2.5L13 8"/></svg> },
    { label: 'Past Papers', href: '/dashboard/past-papers', pct: null, done: Math.round(stats.papers * animPct), total: null, gradient: 'linear-gradient(135deg, #34d399, #06b6d4)', bar: 'linear-gradient(90deg, #34d399, #06b6d4)', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V9l4-4 4 4 4-6"/><path d="M3 17h14"/></svg> },
  ]

  const QUICK_NAV = [
    { href: '/dashboard/past-papers', label: 'Past Papers', icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V9l4-4 4 4 4-6"/><path d="M3 17h14"/></svg> },
    { href: '/dashboard/calendar',    label: 'Calendar',    icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="14" rx="3"/><path d="M3 8h14M7 2v4M13 2v4"/></svg> },
    { href: '/dashboard/drive',       label: 'Drive',       icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l3.5-7h7L17 14H3z"/><path d="M3 14h14"/><circle cx="7" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg> },
    { href: '/dashboard/spotify',     label: 'Spotify',     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg> },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Greeting ── */}
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <p className="page-eyebrow">Overview</p>
        <h1 className="gradient-text" style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          {greeting}, {name} {greetingEmoji}
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 5 }}>
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}
          {!loading && (stats.hw - stats.hwDone > 0 ? ` · ${stats.hw - stats.hwDone} homework pending` : ' · All homework done 🎉')}
          {!ciLoading && todayDone > 0 && ` · ${todayDone}/5 daily tasks done`}
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 14, marginBottom: 20 }}>
        {STAT_CARDS.map((card, i) => (
          <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
            <div className="glass-card fade-up" style={{ padding: isMobile ? '16px 14px' : '20px 22px', animationDelay: `${i * 50}ms`, cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>{card.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{card.label}</div>
              {loading ? <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 14 }} /> : (
                <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 720, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>
                  {card.done}
                  {card.total !== null && <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>/ {card.total}</span>}
                  {(card as any).suffix && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 5 }}>{(card as any).suffix}</span>}
                </div>
              )}
              {card.pct !== null && (
                <div>
                  <div style={{ height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: loading ? '0%' : `${card.pct}%`, background: card.bar, borderRadius: 6, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{loading ? '—' : `${card.pct}% complete`}</div>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Daily check-in + History ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.15fr', gap: 14, marginBottom: 14 }}>

        {/* ── Daily Check-in ── */}
        <div className="glass-card fade-up" style={{ padding: '20px 22px', animationDelay: '180ms', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p className="page-eyebrow" style={{ marginBottom: 3 }}>Daily Habits</p>
              <h2 style={{ fontSize: 15, fontWeight: 680, color: 'var(--text-primary)' }}>Today&apos;s Check-in</h2>
            </div>
            {/* Progress ring */}
            <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
              <svg width="52" height="52" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="5" />
                <circle cx="26" cy="26" r="21" fill="none"
                  stroke={todayDone === 5 ? '#22c55e' : todayDone >= 3 ? '#6366f1' : '#a78bfa'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 21}`}
                  strokeDashoffset={`${2 * Math.PI * 21 * (1 - todayPct / 100)}`}
                  transform="rotate(-90 26 26)"
                  style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1), stroke 0.4s' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 720, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{todayDone}/5</span>
              </div>
            </div>
          </div>

          {/* Streak chip */}
          {streak > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.22)', marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>🔥</span>
              <span style={{ fontSize: 12, fontWeight: 620, color: '#f59e0b' }}>{streak} day streak</span>
            </div>
          )}

          {/* Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ITEMS.map(item => {
              const done = todayCI?.[item.key] ?? false
              const saving = savingCI === item.key
              return (
                <button key={item.key} onClick={() => toggleItem(item.key)} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${done ? item.color + '30' : 'rgba(200,210,240,0.35)'}`, background: done ? item.color + '0e' : 'rgba(255,255,255,0.5)', cursor: 'pointer', textAlign: 'left', fontFamily: 'Geist, sans-serif', transition: 'all 0.22s ease', opacity: saving ? 0.65 : 1 }}>
                  {/* Circle checkbox */}
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${done ? item.color : 'rgba(148,163,184,0.4)'}`, background: done ? item.color : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: done ? `0 2px 10px ${item.color}44` : 'none' }}>
                    {done && (
                      <svg width="11" height="11" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: done ? 600 : 500, color: done ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: done ? 'none' : 'none', transition: 'color 0.18s' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
                  </div>
                  {/* Time badge */}
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: done ? item.color : 'var(--text-muted)', background: done ? item.color + '18' : 'rgba(148,163,184,0.12)', padding: '2px 7px', borderRadius: 5, flexShrink: 0, transition: 'all 0.18s' }}>{item.time}</span>
                </button>
              )
            })}
          </div>

          {/* All done celebration */}
          {todayDone === 5 && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(99,102,241,0.07))', border: '1px solid rgba(34,197,94,0.22)', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 620, color: '#22c55e' }}>🎉 Perfect day! All 5 tasks done.</p>
            </div>
          )}
        </div>

        {/* ── Due Soon ── */}
        <div className="glass-card fade-up" style={{ padding: '20px 22px', animationDelay: '220ms', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p className="page-eyebrow" style={{ marginBottom: 3 }}>Homework</p>
              <h2 style={{ fontSize: 15, fontWeight: 680, color: 'var(--text-primary)' }}>Due Soon</h2>
            </div>
            <Link href="/dashboard/homework" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>

          {/* Next due countdown */}
          {!loading && nextHW && (
            <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(167,139,250,0.05))', border: '1px solid rgba(99,102,241,0.14)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--accent-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Next due</div>
              <div style={{ fontSize: 13.5, fontWeight: 640, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: nextHW.subject ? 4 : 10 }}>{nextHW.title}</div>
              {nextHW.subject && <span className="subject-tag" style={{ display: 'inline-block', marginBottom: 10 }}>{nextHW.subject}</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: countdown.d, l: 'd' }, { v: countdown.h, l: 'h' }, { v: countdown.m, l: 'm' }, { v: countdown.s, l: 's' }].map(({ v, l }) => (
                  <div key={l} style={{ textAlign: 'center', flex: 1, background: 'rgba(255,255,255,0.72)', borderRadius: 10, padding: '7px 6px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(80,100,200,0.07)' }}>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: isMobile ? 18 : 20, fontWeight: 700, color: 'var(--accent-deep)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{String(v).padStart(2, '0')}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600, letterSpacing: '0.06em' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming HW list */}
          {loading ? <SkeletonList /> : upcomingHW.length === 0
            ? <Empty label="All clear! 🎉" sub="No upcoming homework" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {upcomingHW.map((hw: any) => {
                  const due = getDueLabel(hw.due_date)
                  return (
                    <div key={hw.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.8)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 520, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hw.title}</div>
                        {hw.subject && <span className="subject-tag" style={{ marginTop: 3, display: 'inline-block' }}>{hw.subject}</span>}
                      </div>
                      <span style={{ fontSize: 11.5, color: due.color, fontWeight: 580, flexShrink: 0, background: due.bg, padding: '2px 8px', borderRadius: 6 }}>{due.label}</span>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>

      {/* ── Open Tasks (full width) ── */}
      <div className="glass-card fade-up" style={{ padding: 22, animationDelay: '260ms', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 660, color: 'var(--text-primary)' }}>Open Tasks</h2>
          <Link href="/dashboard/todos" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
        </div>
        {loading ? <SkeletonList /> : recentTodos.length === 0
          ? <Empty label="Nothing pending 🎉" sub="You're on top of everything" />
          : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 7 }}>
              {recentTodos.map((t: any) => {
                const pc = t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#22c55e'
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.8)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: pc, boxShadow: `0 0 6px ${pc}66` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 520, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      {t.subject && <span className="subject-tag" style={{ marginTop: 3, display: 'inline-block' }}>{t.subject}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
        }
      </div>

      {/* ── Quick nav ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 40 }}>
        {QUICK_NAV.map((item, i) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div className="glass-card fade-up" style={{ padding: '16px 12px', cursor: 'pointer', animationDelay: `${380 + i * 40}ms`, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent-mid)', marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 620, color: 'var(--text-primary)' }}>{item.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function SkeletonList() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44, animationDelay: `${i * 80}ms` }} />)}</div>
}
function Empty({ label, sub }: { label: string; sub: string }) {
  return <div style={{ padding: '28px 0', textAlign: 'center' }}><p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>{label}</p><p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 3 }}>{sub}</p></div>
}
