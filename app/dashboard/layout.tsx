'use client'
import { useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Dashboard',   icon: IconDash,   key: 'h' },
  { href: '/dashboard/homework',    label: 'Homework',    icon: IconBook,   key: 'w' },
  { href: '/dashboard/todos',       label: 'To-do',       icon: IconCheck,  key: 't' },
  { href: '/dashboard/past-papers', label: 'Past Papers', icon: IconChart,  key: 'p' },
  { href: '/dashboard/timer',       label: 'Study Timer', icon: IconTimer,  key: 's' },
  { href: '/dashboard/calendar',    label: 'Calendar',    icon: IconCal,    key: 'c' },
  { href: '/dashboard/notes',       label: 'Notes',       icon: IconNotes,  key: 'n' },
  { href: '/dashboard/drive',       label: 'Drive',       icon: IconDrive,  key: 'd' },
]

function IconDash({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="7" height="7" rx="2.5"/><rect x="11" y="2" width="7" height="7" rx="2.5"/><rect x="2" y="11" width="7" height="7" rx="2.5"/><rect x="11" y="11" width="7" height="7" rx="2.5"/></svg>
}
function IconBook({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h9a2 2 0 012 2v11a2 2 0 01-2 2H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M15 14h1a1 1 0 000-2h-1"/><path d="M7 7h5M7 10h5M7 13h3"/></svg>
}
function IconCheck({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="3.5"/><path d="M7 10l2.5 2.5L13 8"/></svg>
}
function IconChart({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V9l4-4 4 4 4-6"/><path d="M3 17h14"/></svg>
}
function IconTimer({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="11" r="7"/><path d="M10 7v4l2.5 2.5"/><path d="M8 2h4"/></svg>
}
function IconCal({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="14" rx="3"/><path d="M3 8h14M7 2v4M13 2v4"/></svg>
}
function IconNotes({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M7 7h6M7 10h6M7 13h4"/></svg>
}
function IconDrive({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l3.5-7h7L17 14H3z"/><path d="M3 14h14"/><circle cx="7" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>
}
function IconLogout({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10H3m0 0l3-3m-3 3l3 3"/><path d="M9 6V4a1 1 0 011-1h6a1 1 0 011 1v12a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2"/></svg>
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [hovered, setHovered] = useState(false)
  const [islandExpanded, setIslandExpanded] = useState(false)
  const [time, setTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [gPressed, setGPressed] = useState(false)
  const gTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (!loading && !user) router.replace('/') }, [user, loading, router])
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (e.key === '?') { setShowShortcuts(s => !s); return }
    if (e.key === 'Escape') { setShowShortcuts(false); setGPressed(false); return }

    if (e.key === 'g' || e.key === 'G') {
      setGPressed(true)
      if (gTimer.current) clearTimeout(gTimer.current)
      gTimer.current = setTimeout(() => setGPressed(false), 1500)
      return
    }

    if (gPressed) {
      const item = NAV_ITEMS.find(n => n.key === e.key.toLowerCase())
      if (item) { router.push(item.href); setGPressed(false); if (gTimer.current) clearTimeout(gTimer.current) }
      return
    }
  }, [gPressed, router])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const navW = hovered ? 'var(--nav-w-open)' : 'var(--nav-w)'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>
      <div className="grid-bg" />
      <div className="orb-1" /><div className="orb-2" /><div className="orb-3" />

      {/* Floating sidebar */}
      <aside
        className="glass-nav"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed', top: 12, left: 12, bottom: 12,
          width: navW, zIndex: 50, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          borderRadius: 22,
          transition: 'width 0.34s cubic-bezier(0.4,0,0.2,1)',
          willChange: 'width',
          boxShadow: '0 8px 40px rgba(80,100,200,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 14px 14px', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2z" fill="white" fillOpacity=".95"/>
              <path d="M8 8h4v4H8z" fill="white" fillOpacity=".35"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 720, color: 'var(--text-primary)', letterSpacing: '-0.03em', opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(-8px)', transition: 'opacity 0.22s ease, transform 0.22s ease', whiteSpace: 'nowrap' }}>beam.</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '2px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map((item, i) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`} title={!hovered ? item.label : undefined} style={{ justifyContent: 'flex-start' }}>
                <span style={{ flexShrink: 0, display: 'flex', color: active ? 'var(--accent)' : 'currentColor', opacity: active ? 1 : 0.58, transition: 'opacity 0.2s, color 0.2s' }}>
                  <Icon s={18} />
                </span>
                <span style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(-6px)', transition: `opacity 0.22s ease ${i * 14}ms, transform 0.22s ease ${i * 14}ms`, pointerEvents: 'none', fontSize: 13.5, fontWeight: active ? 640 : 460 }}>
                  {item.label}
                </span>
                {/* Shortcut hint */}
                {hovered && !active && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', opacity: 0.5, background: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>g{item.key}</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div style={{ height: 1, margin: '0 10px', background: 'rgba(99,102,241,0.07)', flexShrink: 0 }} />

        {/* User footer */}
        <div style={{ padding: '10px 8px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 14, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.07)' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }}>
              {user.email?.[0].toUpperCase()}
            </div>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 520, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: hovered ? 1 : 0, transition: 'opacity 0.22s ease' }}>{user.email}</span>
            <button onClick={signOut} title="Sign out" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 7, opacity: hovered ? 0.65 : 0, transition: 'opacity 0.22s, color 0.15s', flexShrink: 0 }}>
              <IconLogout s={15} />
            </button>
          </div>
          {hovered && (
            <button onClick={() => setShowShortcuts(true)} style={{ marginTop: 6, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11.5, padding: '4px 0', fontFamily: 'Geist, sans-serif', opacity: 0.6, transition: 'opacity 0.15s' }}>
              ⌨ Keyboard shortcuts (?)
            </button>
          )}
        </div>
      </aside>

      {/* G key hint */}
      {gPressed && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'rgba(6,6,18,0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 20px', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, animation: 'scaleIn 0.2s ease' }}>
          <span style={{ color: 'var(--accent-mid)' }}>g</span> +
          {NAV_ITEMS.map(n => <span key={n.key} style={{ opacity: 0.65 }}><span style={{ color: 'white', opacity: 1 }}>{n.key}</span></span>)}
        </div>
      )}

      {/* Shortcuts panel */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 660, color: 'var(--text-primary)' }}>⌨ Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 640, color: 'var(--accent-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Navigation (press g then key)</p>
              {NAV_ITEMS.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(99,102,241,0.04)', borderRadius: 10 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{item.label}</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Kbd>g</Kbd><Kbd>{item.key}</Kbd>
                  </div>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(99,102,241,0.08)', margin: '6px 0' }} />
              <p style={{ fontSize: 11, fontWeight: 640, color: 'var(--accent-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>General</p>
              {[['Show shortcuts', '?'], ['Close/dismiss', 'Esc']].map(([label, k]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(99,102,241,0.04)', borderRadius: 10 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{label}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main style={{ marginLeft: 'calc(var(--nav-w) + 24px)', flex: 1, position: 'relative', zIndex: 1, transition: 'margin-left 0.34s cubic-bezier(0.4,0,0.2,1)', minHeight: '100vh' }}>
        {/* Dynamic Island */}
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div className="dynamic-island" onClick={() => setIslandExpanded(!islandExpanded)} style={{ padding: islandExpanded ? '9px 22px' : '7px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {islandExpanded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontWeight: 400, fontSize: 14, letterSpacing: '0.04em' }}>{time}</span>
                <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{new Date().toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>beam.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#818cf8', animation: 'pulse-dot 2s ease infinite' }} />
                <span style={{ fontFamily: 'Geist Mono, monospace', color: 'rgba(255,255,255,0.84)', fontSize: 13, letterSpacing: '0.04em' }}>{time}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '28px 36px', paddingTop: 72 }}>
          {mounted ? children : null}
        </div>
      </main>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, padding: '2px 7px', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
      {children}
    </span>
  )
}

