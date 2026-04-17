'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ hw: 0, hwDone: 0, todos: 0, todosDone: 0, papers: 0, studyMins: 0 })
  const [upcomingHW, setUpcomingHW] = useState<any[]>([])
  const [recentTodos, setRecentTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [hw, todos, papers, sessions] = await Promise.all([
        supabase.from('homework').select('*').eq('user_id', user.id),
        supabase.from('todos').select('*').eq('user_id', user.id),
        supabase.from('past_papers').select('id').eq('user_id', user.id),
        supabase.from('study_sessions').select('duration_minutes').eq('user_id', user.id),
      ])
      const hwData = hw.data || []
      const todosData = todos.data || []
      const studyMins = (sessions.data || []).reduce((a: number, s: any) => a + (s.duration_minutes || 0), 0)
      setStats({ hw: hwData.length, hwDone: hwData.filter((h: any) => h.completed).length, todos: todosData.length, todosDone: todosData.filter((t: any) => t.completed).length, papers: (papers.data || []).length, studyMins })
      setUpcomingHW(hwData.filter((h: any) => !h.completed && h.due_date).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 4))
      setRecentTodos(todosData.filter((t: any) => !t.completed).slice(0, 4))
      setLoading(false)
    })()
  }, [user])

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetingEmoji = hour < 5 ? '🌙' : hour < 12 ? '☀️' : hour < 17 ? '👋' : '🌆'
  const name = user?.email?.split('@')[0] || 'student'

  const getDueLabel = (due: string) => {
    const d = new Date(due)
    const diff = Math.ceil((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (diff === 0) return { label: 'Today', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' }
    return { label: `${diff}d`, color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.08)' }
  }

  const HERO_TILES = [
    {
      label: 'Homework', value: loading ? '—' : `${stats.hwDone}/${stats.hw}`,
      sub: 'completed', href: '/dashboard/homework',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      glow: 'rgba(99,102,241,0.45)', icon: '📚',
    },
    {
      label: 'To-do', value: loading ? '—' : `${stats.todosDone}/${stats.todos}`,
      sub: 'done', href: '/dashboard/todos',
      gradient: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
      glow: 'rgba(167,139,250,0.45)', icon: '✅',
    },
    {
      label: 'Past Papers', value: loading ? '—' : String(stats.papers),
      sub: 'logged', href: '/dashboard/past-papers',
      gradient: 'linear-gradient(135deg, #34d399 0%, #06b6d4 100%)',
      glow: 'rgba(52,211,153,0.45)', icon: '📊',
    },
    {
      label: 'Study Time',
      value: loading ? '—' : stats.studyMins >= 60 ? `${Math.floor(stats.studyMins/60)}h ${stats.studyMins%60}m` : `${stats.studyMins}m`,
      sub: 'total', href: '/dashboard/timer',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
      glow: 'rgba(245,158,11,0.45)', icon: '⏱',
    },
  ]

  const QUICK_NAV = [
    { href: '/dashboard/timer',       label: 'Study Timer',  icon: '⏱', color: '#6366f1' },
    { href: '/dashboard/past-papers', label: 'Past Papers',  icon: '📊', color: '#34d399' },
    { href: '/dashboard/calendar',    label: 'Calendar',     icon: '📅', color: '#f59e0b' },
    { href: '/dashboard/notes',       label: 'Notes',        icon: '📝', color: '#a78bfa' },
    { href: '/dashboard/drive',       label: 'Drive',        icon: '☁️', color: '#ec4899' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── HERO: 4 tiles fill first screen ── */}
      <div style={{ height: 'calc(100vh - 100px)', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 16, marginBottom: 48 }}>
        {HERO_TILES.map((tile, i) => (
          <Link key={tile.label} href={tile.href} style={{ textDecoration: 'none' }}>
            <div style={{
              height: '100%',
              background: tile.gradient,
              borderRadius: 28,
              padding: '36px 40px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              boxShadow: `0 20px 60px ${tile.glow}, 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.25)`,
              animation: `heroTile 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms both`,
              cursor: 'pointer', overflow: 'hidden', position: 'relative',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 28px 80px ${tile.glow}, 0 6px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.25)` }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 60px ${tile.glow}, 0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.25)` }}
            >
              {/* Background orb */}
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

              <div>
                <span style={{ fontSize: 32 }}>{tile.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 640, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 16 }}>{tile.label}</div>
              </div>
              <div>
                <div style={{ fontSize: 56, fontWeight: 720, color: 'white', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{tile.value}</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 8, fontWeight: 500 }}>{tile.sub}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── GREETING + DETAIL SECTION ── */}
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <p className="page-eyebrow">Overview</p>
        <h1 style={{ fontSize: 32, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          {greeting}, {name} {greetingEmoji}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}
          {stats.hw - stats.hwDone > 0 ? ` · ${stats.hw - stats.hwDone} hw pending` : ' · All homework done 🎉'}
        </p>
      </div>

      {/* ── TWO COLUMN ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="glass-card fade-up" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 640, color: 'var(--text-primary)' }}>Upcoming Homework</h2>
            <Link href="/dashboard/homework" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          {loading ? <SkeletonList /> : upcomingHW.length === 0
            ? <Empty label="All clear! 🎉" sub="No upcoming homework" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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

        <div className="glass-card fade-up" style={{ padding: 22, animationDelay: '60ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 640, color: 'var(--text-primary)' }}>Open Tasks</h2>
            <Link href="/dashboard/todos" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          {loading ? <SkeletonList /> : recentTodos.length === 0
            ? <Empty label="Nothing pending 🎉" sub="You're on top of everything" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
      </div>

      {/* ── QUICK NAV ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 40 }}>
        {QUICK_NAV.map((item, i) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div className="glass-card fade-up" style={{ padding: '18px', cursor: 'pointer', animationDelay: `${180 + i * 40}ms`, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 12.5, fontWeight: 620, color: 'var(--text-primary)' }}>{item.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        @keyframes heroTile {
          0%   { opacity: 0; transform: scale(0.88) translateY(24px); }
          65%  { transform: scale(1.02) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

function SkeletonList() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44, animationDelay: `${i * 80}ms` }} />)}</div>
}
function Empty({ label, sub }: { label: string; sub: string }) {
  return <div style={{ padding: '28px 0', textAlign: 'center' }}><p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>{label}</p><p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 3 }}>{sub}</p></div>
}
