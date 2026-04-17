'use client'
import { useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Dashboard',    icon: IconDash },
  { href: '/dashboard/homework',    label: 'Homework',     icon: IconBook },
  { href: '/dashboard/todos',       label: 'To-do',        icon: IconCheck },
  { href: '/dashboard/past-papers', label: 'Past Papers',  icon: IconChart },
  { href: '/dashboard/timer',       label: 'Study Timer',  icon: IconTimer },
  { href: '/dashboard/calendar',    label: 'Calendar',     icon: IconCal },
  { href: '/dashboard/notes',       label: 'Notes',        icon: IconNotes },
  { href: '/dashboard/drive',       label: 'Drive',        icon: IconDrive },
]

function IconDash({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="7" height="7" rx="2.5"/><rect x="11" y="2" width="7" height="7" rx="2.5"/><rect x="2" y="11" width="7" height="7" rx="2.5"/><rect x="11" y="11" width="7" height="7" rx="2.5"/></svg>
}
function IconBook({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h9a2 2 0 012 2v11a2 2 0 01-2 2H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M15 14h1a1 1 0 000-2h-1"/><path d="M7 7h5M7 10h5M7 13h3"/></svg>
}
function IconCheck({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 10l2.5 2.5L13 8"/></svg>
}
function IconChart({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V9l4-4 4 4 4-6"/><path d="M3 17h14"/></svg>
}
function IconTimer({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="11" r="7"/><path d="M10 7v4l2.5 2.5"/><path d="M8 2h4"/></svg>
}
function IconCal({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="14" rx="3"/><path d="M3 8h14M7 2v4M13 2v4"/></svg>
}
function IconNotes({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M7 7h6M7 10h6M7 13h4"/></svg>
}
function IconDrive({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l3.5-7h7L17 14H3z"/><path d="M3 14h14"/><circle cx="7" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>
}
function IconLogout({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10H3m0 0l3-3m-3 3l3 3"/><path d="M9 6V4a1 1 0 011-1h6a1 1 0 011 1v12a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2"/></svg>
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [hovered, setHovered] = useState(false)
  const [islandExpanded, setIslandExpanded] = useState(false)
  const [time, setTime] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (!loading && !user) router.replace('/') }, [user, loading, router])
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const navW = hovered ? 'var(--nav-w-open)' : 'var(--nav-w)'
  const initials = user.email ? user.email[0].toUpperCase() : '?'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>
      <div className="grid-bg" />
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="orb-3" />

      {/* Sidebar */}
      <aside
        className="glass-nav"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: navW, zIndex: 50, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.34s cubic-bezier(0.4,0,0.2,1)',
          willChange: 'width',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '22px 14px 16px', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99,102,241,0.38), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2z" fill="white" fillOpacity=".92"/>
              <path d="M8 8h4v4H8z" fill="white" fillOpacity=".38"/>
            </svg>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 660, color: 'var(--text-primary)', letterSpacing: '-0.025em',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(-8px)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
            whiteSpace: 'nowrap',
          }}>beam.</span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map((item, i) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? 'active' : ''}`}
                title={!hovered ? item.label : undefined}
                style={{ justifyContent: 'flex-start' }}
              >
                <span style={{
                  flexShrink: 0, display: 'flex',
                  opacity: active ? 1 : 0.6,
                  transition: 'opacity 0.2s',
                  color: active ? 'var(--accent)' : 'currentColor',
                }}>
                  <Icon s={17} />
                </span>
                <span style={{
                  opacity: hovered ? 1 : 0,
                  transform: hovered ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 0.22s ease ${i * 16}ms, transform 0.22s ease ${i * 16}ms`,
                  pointerEvents: 'none',
                  fontSize: 13.5,
                }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, margin: '0 12px', background: 'rgba(99,102,241,0.08)', flexShrink: 0 }} />

        {/* User footer */}
        <div style={{ padding: '10px 8px 16px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
            borderRadius: 13, background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.07)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 660, color: 'white',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}>
              {initials}
            </div>
            <span style={{
              flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              opacity: hovered ? 1 : 0, transition: 'opacity 0.22s ease',
            }}>
              {user.email}
            </span>
            <button
              onClick={signOut}
              title="Sign out"
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 7,
                opacity: hovered ? 0.7 : 0, transition: 'opacity 0.22s, color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            >
              <IconLogout s={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: 'var(--nav-w)',
        flex: 1,
        position: 'relative', zIndex: 1,
        transition: 'margin-left 0.34s cubic-bezier(0.4,0,0.2,1)',
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Dynamic Island */}
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <div
            className="dynamic-island"
            onClick={() => setIslandExpanded(!islandExpanded)}
            style={{ padding: islandExpanded ? '9px 22px' : '7px 20px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {islandExpanded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontWeight: 400, fontSize: 14, letterSpacing: '0.04em' }}>{time}</span>
                <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  {new Date().toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.01em' }}>beam.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#818cf8', animation: 'pulse-dot 2s ease infinite' }} />
                <span style={{ fontFamily: 'Geist Mono, monospace', color: 'rgba(255,255,255,0.84)', fontSize: 13, letterSpacing: '0.04em' }}>{time}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '28px 36px', paddingTop: 72, flex: 1 }}>
          {mounted ? children : null}
        </div>
      </main>
    </div>
  )
}
