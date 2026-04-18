'use client'
import { useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { isConnected, getPlayer } from '@/lib/spotify'

const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Dashboard',   icon: IconDash,    key: 'h' },
  { href: '/dashboard/homework',    label: 'Homework',    icon: IconBook,    key: 'w' },
  { href: '/dashboard/todos',       label: 'To-do',       icon: IconCheck,   key: 't' },
  { href: '/dashboard/past-papers', label: 'Past Papers', icon: IconChart,   key: 'p' },
  { href: '/dashboard/timer',       label: 'Timer',       icon: IconTimer,   key: 's' },
  { href: '/dashboard/calendar',    label: 'Calendar',    icon: IconCal,     key: 'c' },
  { href: '/dashboard/drive',       label: 'Drive',       icon: IconDrive,   key: 'd' },
  { href: '/dashboard/spotify',     label: 'Spotify',     icon: IconSpotify, key: 'm' },
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
function IconDrive({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l3.5-7h7L17 14H3z"/><path d="M3 14h14"/><circle cx="7" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>
}
function IconSpotify({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
}
function IconLogout({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10H3m0 0l3-3m-3 3l3 3"/><path d="M9 6V4a1 1 0 011-1h6a1 1 0 011 1v12a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2"/></svg>
}
function IconClock({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6.5v3.5l2 2"/></svg>
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [time, setTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [gPressed, setGPressed] = useState(false)
  const [open, setOpen] = useState(false)
  const gTimer = useRef<NodeJS.Timeout | null>(null)
  const [nowPlaying, setNowPlaying] = useState<{ name: string; artist: string; is_playing: boolean } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const poll = async () => {
      if (!isConnected()) return
      const p = await getPlayer()
      if (p?.item) setNowPlaying({ name: p.item.name, artist: p.item.artists[0]?.name ?? '', is_playing: p.is_playing })
      else setNowPlaying(null)
    }
    poll()
    const id = setInterval(poll, 8000)
    return () => clearInterval(id)
  }, [mounted])

  useEffect(() => { if (!loading && !user) router.replace('/') }, [user, loading, router])
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === '?') { setShowShortcuts(s => !s); return }
    if (e.key === 'Escape') { setShowShortcuts(false); setShowUser(false); setGPressed(false); return }
    if (e.key === 'g' || e.key === 'G') {
      setGPressed(true)
      if (gTimer.current) clearTimeout(gTimer.current)
      gTimer.current = setTimeout(() => setGPressed(false), 1500)
      return
    }
    if (gPressed) {
      const item = NAV_ITEMS.find(n => n.key === e.key.toLowerCase())
      if (item) { router.push(item.href); setGPressed(false); if (gTimer.current) clearTimeout(gTimer.current) }
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

  const W = open ? 228 : 60

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative' }}>
      <div className="grid-bg" />
      <div className="noise-overlay" />
      <div className="aurora-wrap">
        <div className="aurora-band-1" />
        <div className="aurora-band-2" />
        <div className="aurora-band-3" />
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
        <div className="aurora-blob-4" />
      </div>

      {/* ── Vertical pill sidebar ── */}
      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { setOpen(false); setShowUser(false) }}
        style={{
          position: 'fixed',
          left: 14, top: 14, bottom: 14,
          zIndex: 50,
          width: W,
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(80px) saturate(2.4)',
          WebkitBackdropFilter: 'blur(80px) saturate(2.4)',
          border: '1px solid rgba(255,255,255,0.94)',
          borderRadius: 24,
          boxShadow: [
            'inset 0 1.5px 0 rgba(255,255,255,1)',
            '0 8px 48px rgba(80,100,200,0.16)',
            '0 2px 8px rgba(80,100,200,0.06)',
            '0 0 0 0.5px rgba(200,210,255,0.22)',
          ].join(', '),
          transition: 'width 0.38s cubic-bezier(0.34,1.56,0.64,1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 10px',
          gap: 0,
        }}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          style={{
            display: 'flex', alignItems: 'center', gap: 11,
            textDecoration: 'none',
            padding: '4px 2px 16px',
            borderBottom: '1px solid rgba(99,102,241,0.08)',
            marginBottom: 10,
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 14px rgba(99,102,241,0.42)',
          }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2z" fill="white" fillOpacity=".95"/>
              <path d="M8 8h4v4H8z" fill="white" fillOpacity=".35"/>
            </svg>
          </div>
          <span style={{
            fontSize: 14, fontWeight: 760, letterSpacing: '-0.035em',
            color: 'var(--text-primary)', whiteSpace: 'nowrap',
            opacity: open ? 1 : 0,
            transform: open ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}>
            productivity.
          </span>
        </Link>

        {/* Nav items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 10px',
                  borderRadius: 14,
                  textDecoration: 'none',
                  fontSize: 13.5, fontWeight: active ? 620 : 450,
                  color: active ? 'var(--accent-deep)' : 'var(--text-secondary)',
                  background: active
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))'
                    : 'transparent',
                  border: active ? '1px solid rgba(99,102,241,0.13)' : '1px solid transparent',
                  boxShadow: active
                    ? '0 2px 10px rgba(99,102,241,0.13), inset 0 1px 0 rgba(255,255,255,0.92)'
                    : 'none',
                  transition: 'all 0.18s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 18, borderRadius: 3,
                    background: 'linear-gradient(to bottom, #6366f1, #a78bfa)',
                  }} />
                )}
                <span style={{
                  flexShrink: 0, display: 'flex',
                  color: active ? 'var(--accent)' : 'currentColor',
                  opacity: active ? 1 : 0.68,
                }}>
                  <Icon s={17} />
                </span>
                <span style={{
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateX(0)' : 'translateX(-4px)',
                  transition: 'opacity 0.18s 0.04s, transform 0.18s 0.04s',
                  overflow: 'hidden',
                }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          paddingTop: 10,
          borderTop: '1px solid rgba(99,102,241,0.08)',
          flexShrink: 0,
          minWidth: 0,
        }}>

          {/* Spotify now-playing */}
          {nowPlaying && (
            <Link href="/dashboard/spotify" style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px', borderRadius: 13,
              background: 'rgba(29,185,84,0.08)',
              border: '1px solid rgba(29,185,84,0.18)',
              textDecoration: 'none', overflow: 'hidden', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{
                    width: 2.5, background: '#1db954', borderRadius: 2,
                    animation: nowPlaying.is_playing ? `equBar${i} 0.7s ease infinite alternate` : 'none',
                    height: nowPlaying.is_playing ? undefined : 3,
                    animationDelay: `${i * 0.12}s`,
                  }} />
                ))}
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: 530, color: '#1db954',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                opacity: open ? 1 : 0,
                transition: 'opacity 0.15s',
              }}>
                {nowPlaying.name}
              </span>
            </Link>
          )}

          {/* Clock */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 13,
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(200,210,240,0.45)',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <span style={{ flexShrink: 0, display: 'flex', color: 'var(--text-muted)' }}>
              <IconClock s={14} />
            </span>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 12.5,
              color: 'var(--text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
              opacity: open ? 1 : 0,
              transition: 'opacity 0.15s',
            }}>
              {time}
            </span>
          </div>

          {/* User */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowUser(s => !s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 6px', border: 'none', background: 'none',
                cursor: 'pointer', borderRadius: 14, overflow: 'hidden',
                transition: 'background 0.18s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{
                width: 36, height: 36, flexShrink: 0, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13.5, fontWeight: 700, color: 'white',
                boxShadow: '0 2px 10px rgba(99,102,241,0.38)',
              }}>
                {user.email?.[0].toUpperCase()}
              </div>
              <div style={{
                textAlign: 'left', flex: 1, minWidth: 0,
                opacity: open ? 1 : 0,
                transform: open ? 'translateX(0)' : 'translateX(-4px)',
                transition: 'opacity 0.18s, transform 0.18s',
              }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 1 }}>signed in as</div>
                <div style={{ fontSize: 12, fontWeight: 580, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 152 }}>
                  {user.email}
                </div>
              </div>
            </button>

            {showUser && open && (
              <div style={{
                position: 'absolute', bottom: 50, left: 0,
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.9)',
                borderRadius: 14, padding: '8px',
                boxShadow: '0 12px 40px rgba(80,100,200,0.18)',
                minWidth: 206, animation: 'scaleIn 0.18s ease', zIndex: 100,
              }}>
                <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(99,102,241,0.07)', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Signed in as</div>
                  <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                </div>
                <button onClick={() => { setShowShortcuts(true); setShowUser(false) }} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '7px 10px', borderRadius: 8, textAlign: 'left', fontFamily: 'Geist, sans-serif', transition: 'background 0.15s' }}>⌨ Keyboard shortcuts</button>
                <button onClick={signOut} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: '7px 10px', borderRadius: 8, textAlign: 'left', fontFamily: 'Geist, sans-serif', display: 'flex', alignItems: 'center', gap: 7, transition: 'background 0.15s' }}>
                  <IconLogout s={13} /> Sign out
                </button>
              </div>
            )}
          </div>
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
        <div className="modal-overlay" onClick={() => { setShowShortcuts(false); setShowUser(false) }}>
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
                  <div style={{ display: 'flex', gap: 5 }}><Kbd>g</Kbd><Kbd>{item.key}</Kbd></div>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(99,102,241,0.08)', margin: '6px 0' }} />
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

      {/* Main content */}
      <main style={{ flex: 1, position: 'relative', zIndex: 1, paddingLeft: 88 }}>
        <div key={pathname} className="page-enter" style={{ padding: '36px 44px', maxWidth: 1360, margin: '0 auto' }}>
          {mounted ? children : null}
        </div>
      </main>

      <style>{`
        @keyframes equBar1 { from { height: 3px; } to { height: 12px; } }
        @keyframes equBar2 { from { height: 6px; } to { height: 16px; } }
        @keyframes equBar3 { from { height: 3px; } to { height: 9px;  } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
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
