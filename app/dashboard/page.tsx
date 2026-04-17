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
      setStats({
        hw: hwData.length,
        hwDone: hwData.filter((h: any) => h.completed).length,
        todos: todosData.length,
        todosDone: todosData.filter((t: any) => t.completed).length,
        papers: (papers.data || []).length,
        studyMins,
      })
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
    const today = new Date()
    const diff = Math.ceil((d.getTime() - today.setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' }
    if (diff === 0) return { label: 'Today', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' }
    if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' }
    return { label: `${diff}d`, color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.07)' }
  }

  const STAT_CARDS = [
    {
      label: 'Homework',
      value: loading ? '—' : `${stats.hwDone}/${stats.hw}`,
      sub: 'completed',
      color: '#6366f1',
      bg: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.07) 100%)',
      border: 'rgba(99,102,241,0.18)',
      href: '/dashboard/homework',
    },
    {
      label: 'To-do',
      value: loading ? '—' : `${stats.todosDone}/${stats.todos}`,
      sub: 'done',
      color: '#a78bfa',
      bg: 'linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(196,181,253,0.07) 100%)',
      border: 'rgba(167,139,250,0.18)',
      href: '/dashboard/todos',
    },
    {
      label: 'Past Papers',
      value: loading ? '—' : String(stats.papers),
      sub: 'logged',
      color: '#34d399',
      bg: 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(16,185,129,0.07) 100%)',
      border: 'rgba(52,211,153,0.18)',
      href: '/dashboard/past-papers',
    },
    {
      label: 'Study Time',
      value: loading ? '—' : stats.studyMins >= 60 ? `${Math.floor(stats.studyMins/60)}h ${stats.studyMins%60}m` : `${stats.studyMins}m`,
      sub: 'total',
      color: '#f59e0b',
      bg: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(251,191,36,0.07) 100%)',
      border: 'rgba(245,158,11,0.18)',
      href: '/dashboard/timer',
    },
  ]

  const QUICK_NAV = [
    { href: '/dashboard/timer',       label: 'Study Timer',   sub: 'Start a session',     color: '#6366f1', icon: '⏱' },
    { href: '/dashboard/past-papers', label: 'Past Papers',   sub: 'Log a result',        color: '#34d399', icon: '📊' },
    { href: '/dashboard/calendar',    label: 'Calendar',      sub: 'View schedule',       color: '#f59e0b', icon: '📅' },
    { href: '/dashboard/notes',       label: 'Notes',         sub: 'Open notebook',       color: '#a78bfa', icon: '📝' },
    { href: '/dashboard/drive',       label: 'Drive',         sub: 'Your files',          color: '#ec4899', icon: '☁️' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p className="page-eyebrow">Overview</p>
            <h1 style={{ fontSize: 32, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              {greeting}, {name} {greetingEmoji}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, fontWeight: 400 }}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div style={{
            padding: '10px 18px', borderRadius: 14,
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 12px rgba(80,100,200,0.07)',
            fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500,
          }}>
            {stats.hw - stats.hwDone > 0
              ? `${stats.hw - stats.hwDone} hw left · ${stats.todos - stats.todosDone} tasks open`
              : '🎉 All caught up!'}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {STAT_CARDS.map(card => (
          <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
            <div
              className="stat-card fade-up"
              style={{
                background: card.bg,
                border: `1px solid ${card.border}`,
                boxShadow: `0 2px 16px ${card.color}18, inset 0 1px 0 rgba(255,255,255,0.7)`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 640, color: card.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, opacity: 0.8 }}>{card.label}</div>
              <div style={{ fontSize: 34, fontWeight: 700, color: card.color, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Two column: HW + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="glass-card fade-up" style={{ padding: 22, animationDelay: '100ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 640, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Upcoming Homework</h2>
            <Link href="/dashboard/homework" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          {loading ? <SkeletonList /> :
            upcomingHW.length === 0
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

        <div className="glass-card fade-up" style={{ padding: 22, animationDelay: '150ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 640, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Open Tasks</h2>
            <Link href="/dashboard/todos" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          {loading ? <SkeletonList /> :
            recentTodos.length === 0
              ? <Empty label="Nothing pending 🎉" sub="You're on top of everything" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {recentTodos.map((t: any) => {
                    const prioColor = t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#22c55e'
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.8)' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: prioColor, boxShadow: `0 0 6px ${prioColor}66` }} />
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

      {/* Quick nav */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 8 }}>
        {QUICK_NAV.map((item, i) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div
              className="glass-card fade-up"
              style={{ padding: '16px 18px', cursor: 'pointer', animationDelay: `${200 + i * 50}ms` }}
            >
              <div style={{ fontSize: 20, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 620, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{item.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{item.sub}</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {[1,2,3].map(i => (
        <div key={i} className="skeleton" style={{ height: 44, animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  )
}

function Empty({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ padding: '28px 0', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>{label}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 3 }}>{sub}</p>
    </div>
  )
}
