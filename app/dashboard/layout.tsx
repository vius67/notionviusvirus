'use client'
import { useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { isConnected, getPlayer } from '@/lib/spotify'

// ── Theme system ──────────────────────────────────────────────────────────────
const THEMES = [
  { id: 'light',  label: 'Light',  swatch: 'linear-gradient(135deg, #e8eaff, #eef5ff)' },
  { id: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg, #22c55e 0%, #8b5cf6 100%)' },
  { id: 'dark',   label: 'Dark',   swatch: 'linear-gradient(135deg, #1e1b4b, #0f172a)' },
  { id: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 100%)' },
] as const
type Theme = typeof THEMES[number]['id']

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Dashboard',   icon: IconDash,    key: 'h' },
  { href: '/dashboard/homework',    label: 'Homework',    icon: IconBook,    key: 'w' },
  { href: '/dashboard/todos',       label: 'To-do',       icon: IconCheck,   key: 't' },
  { href: '/dashboard/past-papers', label: 'Past Papers', icon: IconChart,   key: 'p' },
  { href: '/dashboard/timer',       label: 'Timer',       icon: IconTimer,   key: 's' },
  { href: '/dashboard/calendar',    label: 'Calendar',    icon: IconCal,     key: 'c' },
  { href: '/dashboard/kurt',        label: 'Kurt',        icon: IconKurt,    key: 'k' },
  { href: '/dashboard/drive',       label: 'Drive',       icon: IconDrive,   key: 'd' },
  { href: '/dashboard/spotify',     label: 'Spotify',     icon: IconSpotify, key: 'm' },
]
const MOBILE_PRIMARY = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[5], NAV_ITEMS[6]]
const MOBILE_MORE    = [NAV_ITEMS[3], NAV_ITEMS[4], NAV_ITEMS[7], NAV_ITEMS[8]]

// ── Icons ─────────────────────────────────────────────────────────────────────
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
function IconKurt({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2l1.8 3.6L16 6.2l-3 2.9.7 4.1L10 11.1l-3.7 2.1.7-4.1L4 6.2l4.2-.6L10 2z"/><path d="M6 17h8"/><path d="M10 14v3"/></svg>
}
function IconMore({ s }: { s: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg>
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [time, setTime]               = useState('')
  const [mounted, setMounted]         = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showUser, setShowUser]       = useState(false)
  const [showMore, setShowMore]       = useState(false)
  const [showTheme, setShowTheme]     = useState(false)
  const [gPressed, setGPressed]       = useState(false)
  const [open, setOpen]               = useState(false)
  const [isMobile, setIsMobile]       = useState(false)
  const [theme, setThemeState]        = useState<Theme>('sunset')
  const gTimer      = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [nowPlaying, setNowPlaying]   = useState<{ name: string; artist: string; is_playing: boolean } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Load theme
  useEffect(() => {
    const saved = localStorage.getItem('app-theme') as Theme | null
    if (saved && THEMES.find(t => t.id === saved)) setThemeState(saved)
  }, [])

  // Apply theme to <html data-theme="...">
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    document.documentElement.dataset.theme = t === 'light' ? '' : t
    localStorage.setItem('app-theme', t)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? '' : theme
  }, [theme])

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Spotify poll
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

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === '?') { setShowShortcuts(s => !s); return }
    if (e.key === 'Escape') { setShowShortcuts(false); setShowUser(false); setGPressed(false); setShowMore(false); setShowTheme(false); return }
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

  // Swipe nav (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.8) return
    const idx = NAV_ITEMS.findIndex(n => n.href === pathname)
    if (dx < 0 && idx < NAV_ITEMS.length - 1) router.push(NAV_ITEMS[idx + 1].href)
    else if (dx > 0 && idx > 0) router.push(NAV_ITEMS[idx - 1].href)
  }, [pathname, router])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Theme-derived inline styles ───────────────────────────────────────────
  const isDark   = theme === 'dark'
  const isSunset = theme === 'sunset'

  const navBg      = isDark   ? 'rgba(8,10,20,0.95)'     : 'rgba(255,255,255,0.80)'
  const navBorder  = isDark   ? 'rgba(255,255,255,0.07)'  : 'rgba(255,255,255,0.94)'
  const navShadow  = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.45)'
    : 'inset 0 1.5px 0 rgba(255,255,255,1), 0 8px 48px rgba(80,100,200,0.16), 0 2px 8px rgba(80,100,200,0.06), 0 0 0 0.5px rgba(200,210,255,0.22)'
  const divider    = isDark   ? 'rgba(255,255,255,0.06)'  : 'rgba(99,102,241,0.08)'
  const chipBg     = isDark   ? 'rgba(255,255,255,0.05)'  : 'rgba(255,255,255,0.55)'
  const chipBorder = isDark   ? 'rgba(255,255,255,0.08)'  : 'rgba(200,210,240,0.45)'
  const hoverBg    = isDark   ? 'rgba(255,255,255,0.07)'  : 'rgba(99,102,241,0.06)'
  const activeNavBg = isDark
    ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.16))'
    : isSunset
      ? 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(251,146,60,0.10))'
      : 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))'
  const activeNavBorder = isDark ? 'rgba(99,102,241,0.28)' : isSunset ? 'rgba(244,63,94,0.22)' : 'rgba(99,102,241,0.13)'
  const mobileBarBg     = isDark ? 'rgba(8,10,20,0.96)'    : 'rgba(255,255,255,0.90)'
  const mobileBarBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)'
  const dropdownBg      = isDark ? 'rgba(10,11,22,0.98)'   : 'rgba(255,255,255,0.97)'
  const dropdownBorder  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)'
  const currentTheme    = THEMES.find(t => t.id === theme)!
  const sidebarW        = open ? 228 : 60

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflowX: 'hidden' }}>
      <div className="grid-bg" />
      <div className="noise-overlay" />
      {/* Aurora only visible in aurora theme */}
      <div className="aurora-wrap" style={{ opacity: theme === 'aurora' ? 1 : 0 }}>
        <div className="aurora-band-1" /><div className="aurora-band-2" /><div className="aurora-band-3" />
        <div className="aurora-ray-1" /><div className="aurora-ray-2" /><div className="aurora-ray-3" /><div className="aurora-ray-4" />
        <div className="aurora-blob-1" /><div className="aurora-blob-2" /><div className="aurora-blob-3" /><div className="aurora-blob-4" />
      </div>

      {/* ── DESKTOP: Vertical pill sidebar ── */}
      {!isMobile && (
        <aside
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => { setOpen(false); setShowUser(false) }}
          style={{
            position: 'fixed', left: 14, top: 14, bottom: 14, zIndex: 50,
            width: sidebarW,
            background: navBg,
            backdropFilter: 'blur(80px) saturate(2.4)',
            WebkitBackdropFilter: 'blur(80px) saturate(2.4)',
            border: `1px solid ${navBorder}`,
            borderRadius: 24,
            boxShadow: navShadow,
            transition: 'width 0.38s cubic-bezier(0.34,1.56,0.64,1), background 0.6s, border-color 0.6s, box-shadow 0.6s',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            padding: '14px 10px', gap: 0,
          }}
        >
          {/* Logo */}
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', padding: '4px 2px 16px', borderBottom: `1px solid ${divider}`, marginBottom: 10, flexShrink: 0, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 14px rgba(99,102,241,0.42)' }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2z" fill="white" fillOpacity=".95"/><path d="M8 8h4v4H8z" fill="white" fillOpacity=".35"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 760, letterSpacing: '-0.035em', color: 'var(--text-primary)', whiteSpace: 'nowrap', opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(-6px)', transition: 'opacity 0.2s, transform 0.2s' }}>productivity.</span>
          </Link>

          {/* Nav items */}
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href
              const Icon   = item.icon
              return (
                <Link key={item.href} href={item.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 14, textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 620 : 450, color: active ? 'var(--accent-deep)' : 'var(--text-secondary)', background: active ? activeNavBg : 'transparent', border: `1px solid ${active ? activeNavBorder : 'transparent'}`, boxShadow: active ? `0 2px 10px rgba(99,102,241,${isDark ? '0.28' : '0.13'}), inset 0 1px 0 rgba(255,255,255,${isDark ? '0.08' : '0.92'})` : 'none', transition: 'all 0.18s ease', whiteSpace: 'nowrap', flexShrink: 0, position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = hoverBg }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {active && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: 3, background: isSunset ? 'linear-gradient(to bottom, #f43f5e, #fb923c)' : 'linear-gradient(to bottom, #6366f1, #a78bfa)' }} />}
                  <span style={{ flexShrink: 0, display: 'flex', color: active ? 'var(--accent)' : 'currentColor', opacity: active ? 1 : 0.68 }}><Icon s={17} /></span>
                  <span style={{ opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(-4px)', transition: 'opacity 0.18s 0.04s, transform 0.18s 0.04s', overflow: 'hidden' }}>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Sidebar bottom section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: `1px solid ${divider}`, flexShrink: 0, minWidth: 0 }}>

            {/* Spotify now playing */}
            {nowPlaying && (
              <Link href="/dashboard/spotify" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 13, background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.18)', textDecoration: 'none', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                  {[1,2,3].map(i => <div key={i} style={{ width: 2.5, background: '#1db954', borderRadius: 2, animation: nowPlaying.is_playing ? `equBar${i} 0.7s ease infinite alternate` : 'none', height: nowPlaying.is_playing ? undefined : 3, animationDelay: `${i*0.12}s` }} />)}
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 530, color: '#1db954', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: open ? 1 : 0, transition: 'opacity 0.15s' }}>{nowPlaying.name}</span>
              </Link>
            )}

            {/* Clock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 13, background: chipBg, border: `1px solid ${chipBorder}`, overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ flexShrink: 0, display: 'flex', color: 'var(--text-muted)' }}><IconClock s={14} /></span>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12.5, color: 'var(--text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap', opacity: open ? 1 : 0, transition: 'opacity 0.15s' }}>{time}</span>
            </div>

            {/* Theme picker */}
            <div style={{ borderRadius: 13, background: chipBg, border: `1px solid ${chipBorder}`, flexShrink: 0, overflow: 'hidden', padding: '8px 10px' }}>
              {/* Always-visible row: small swatch + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, background: currentTheme.swatch, boxShadow: '0 1px 5px rgba(0,0,0,0.22)' }} />
                <span style={{ fontSize: 11.5, fontWeight: 540, color: 'var(--text-muted)', opacity: open ? 1 : 0, transition: 'opacity 0.15s', whiteSpace: 'nowrap' }}>Theme</span>
              </div>
              {/* Swatches — fade in when open */}
              <div style={{ display: 'flex', gap: 5, marginTop: open ? 8 : 0, maxHeight: open ? 24 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'opacity 0.18s, max-height 0.22s, margin-top 0.18s' }}>
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} title={t.label} style={{
                    flex: 1, height: 18, borderRadius: 5, background: t.swatch,
                    border: theme === t.id ? '2px solid rgba(255,255,255,0.92)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.22s',
                    boxShadow: theme === t.id ? '0 2px 10px rgba(0,0,0,0.32)' : '0 1px 3px rgba(0,0,0,0.14)',
                    outline: 'none',
                  }} />
                ))}
              </div>
            </div>

            {/* User */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowUser(s => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 14, overflow: 'hidden', transition: 'background 0.18s' }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: 'white', boxShadow: '0 2px 10px rgba(99,102,241,0.38)' }}>{user.email?.[0].toUpperCase()}</div>
                <div style={{ textAlign: 'left', flex: 1, minWidth: 0, opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(-4px)', transition: 'opacity 0.18s, transform 0.18s' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 1 }}>signed in as</div>
                  <div style={{ fontSize: 12, fontWeight: 580, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 152 }}>{user.email}</div>
                </div>
              </button>
              {showUser && open && (
                <div style={{ position: 'absolute', bottom: 50, left: 0, background: dropdownBg, backdropFilter: 'blur(40px)', border: `1px solid ${dropdownBorder}`, borderRadius: 14, padding: '8px', boxShadow: '0 12px 40px rgba(80,100,200,0.18)', minWidth: 206, animation: 'scaleIn 0.18s ease', zIndex: 100 }}>
                  <div style={{ padding: '8px 10px 10px', borderBottom: `1px solid ${divider}`, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Signed in as</div>
                    <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                  <button onClick={() => { setShowShortcuts(true); setShowUser(false) }} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '7px 10px', borderRadius: 8, textAlign: 'left', fontFamily: 'Geist, sans-serif' }}>⌨ Keyboard shortcuts</button>
                  <button onClick={signOut} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: '7px 10px', borderRadius: 8, textAlign: 'left', fontFamily: 'Geist, sans-serif', display: 'flex', alignItems: 'center', gap: 7 }}><IconLogout s={13} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ── MOBILE: Top bar ── */}
      {isMobile && (
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56, background: mobileBarBg, backdropFilter: 'blur(48px) saturate(2.2)', WebkitBackdropFilter: 'blur(48px) saturate(2.2)', borderBottom: `1px solid ${mobileBarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', boxShadow: isDark ? '0 2px 20px rgba(0,0,0,0.4)' : '0 2px 20px rgba(80,100,200,0.08)', transition: 'background 0.6s, border-color 0.6s' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(99,102,241,0.38)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2z" fill="white" fillOpacity=".95"/><path d="M8 8h4v4H8z" fill="white" fillOpacity=".35"/></svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 760, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>productivity.</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {nowPlaying && (
              <Link href="/dashboard/spotify" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: 'rgba(29,185,84,0.09)', border: '1px solid rgba(29,185,84,0.2)', textDecoration: 'none', maxWidth: 120, overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexShrink: 0 }}>
                  {[1,2,3].map(i => <div key={i} style={{ width: 2, background: '#1db954', borderRadius: 2, animation: nowPlaying.is_playing ? `equBar${i} 0.7s ease infinite alternate` : 'none', height: 3, animationDelay: `${i*0.12}s` }} />)}
                </div>
                <span style={{ fontSize: 11, fontWeight: 520, color: '#1db954', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowPlaying.name}</span>
              </Link>
            )}
            {/* Theme picker button */}
            <button onClick={() => { setShowTheme(s => !s); setShowUser(false) }} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(200,210,240,0.5)'}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all 0.3s' }}>
              <div style={{ width: 16, height: 16, borderRadius: 5, background: currentTheme.swatch, boxShadow: '0 1px 5px rgba(0,0,0,0.2)' }} />
            </button>
            {/* User avatar */}
            <button onClick={() => { setShowUser(s => !s); setShowTheme(false) }} style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a78bfa)', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'white', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
              {user.email?.[0].toUpperCase()}
            </button>
          </div>
        </header>
      )}

      {/* ── MOBILE: Theme panel ── */}
      {isMobile && showTheme && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowTheme(false)} />
          <div style={{ position: 'fixed', top: 64, right: 12, zIndex: 99, background: dropdownBg, backdropFilter: 'blur(48px)', border: `1px solid ${dropdownBorder}`, borderRadius: 16, padding: '14px 16px', boxShadow: '0 12px 40px rgba(80,100,200,0.2)', animation: 'scaleIn 0.18s ease', minWidth: 210 }}>
            <p style={{ fontSize: 11, fontWeight: 640, color: 'var(--accent-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Theme</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => { setTheme(t.id); setShowTheme(false) }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 10px', borderRadius: 12, border: `2px solid ${theme === t.id ? (isSunset ? '#f43f5e' : '#6366f1') : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(200,210,240,0.4)')}`, background: theme === t.id ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.06)') : 'transparent', cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'Geist, sans-serif' }}>
                  <div style={{ width: 44, height: 26, borderRadius: 8, background: t.swatch, boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }} />
                  <span style={{ fontSize: 11.5, fontWeight: theme === t.id ? 640 : 460, color: theme === t.id ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE: User dropdown ── */}
      {isMobile && showUser && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowUser(false)} />
          <div style={{ position: 'fixed', top: 64, right: 12, zIndex: 99, background: dropdownBg, backdropFilter: 'blur(40px)', border: `1px solid ${dropdownBorder}`, borderRadius: 16, padding: '8px', boxShadow: '0 12px 40px rgba(80,100,200,0.18)', minWidth: 200, animation: 'scaleIn 0.18s ease' }}>
            <div style={{ padding: '8px 10px 10px', borderBottom: `1px solid ${divider}`, marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Signed in as</div>
              <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
            <button onClick={signOut} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: '7px 10px', borderRadius: 8, textAlign: 'left', fontFamily: 'Geist, sans-serif', display: 'flex', alignItems: 'center', gap: 7 }}><IconLogout s={13} /> Sign out</button>
          </div>
        </>
      )}

      {/* ── MOBILE: Bottom tab bar ── */}
      {isMobile && (
        <>
          <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: mobileBarBg, backdropFilter: 'blur(48px) saturate(2.2)', WebkitBackdropFilter: 'blur(48px) saturate(2.2)', borderTop: `1px solid ${mobileBarBorder}`, paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', alignItems: 'stretch', boxShadow: isDark ? '0 -4px 24px rgba(0,0,0,0.4)' : '0 -4px 24px rgba(80,100,200,0.08)', transition: 'background 0.6s' }}>
            {MOBILE_PRIMARY.map(item => {
              const active = pathname === item.href
              const Icon   = item.icon
              return (
                <Link key={item.href} href={item.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '10px 4px 8px', textDecoration: 'none', color: active ? 'var(--accent)' : 'var(--text-muted)', position: 'relative' }}>
                  {active && <span style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 2.5, borderRadius: 2, background: isSunset ? 'linear-gradient(90deg, #f43f5e, #fb923c)' : 'linear-gradient(90deg, #6366f1, #a78bfa)' }} />}
                  <span style={{ opacity: active ? 1 : 0.6, transition: 'all 0.18s', transform: active ? 'scale(1.12)' : 'scale(1)' }}><Icon s={20} /></span>
                  <span style={{ fontSize: 9.5, fontWeight: active ? 640 : 450, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>{item.label}</span>
                </Link>
              )
            })}
            <button onClick={() => setShowMore(s => !s)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '10px 4px 8px', border: 'none', background: 'none', cursor: 'pointer', color: MOBILE_MORE.some(m => m.href === pathname) ? 'var(--accent)' : 'var(--text-muted)' }}>
              <span style={{ opacity: 0.6 }}><IconMore s={20} /></span>
              <span style={{ fontSize: 9.5, fontWeight: 450, letterSpacing: '0.01em' }}>More</span>
            </button>
          </nav>

          {showMore && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 58, background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.18)', backdropFilter: 'blur(4px)' }} onClick={() => setShowMore(false)} />
              <div style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom))', left: 12, right: 12, zIndex: 59, background: dropdownBg, backdropFilter: 'blur(48px)', border: `1px solid ${dropdownBorder}`, borderRadius: 20, padding: '16px', boxShadow: isDark ? '0 -8px 40px rgba(0,0,0,0.5)' : '0 -8px 40px rgba(80,100,200,0.14)', animation: 'slideUp 0.26s cubic-bezier(0.34,1.56,0.64,1)' }}>
                <p style={{ fontSize: 11, fontWeight: 640, color: 'var(--accent-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>More pages</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {MOBILE_MORE.map(item => {
                    const active = pathname === item.href
                    const Icon   = item.icon
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setShowMore(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px', borderRadius: 14, textDecoration: 'none', background: active ? activeNavBg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.04)'), border: `1px solid ${active ? activeNavBorder : 'transparent'}`, color: active ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
                        <span style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}><Icon s={22} /></span>
                        <span style={{ fontSize: 11.5, fontWeight: active ? 620 : 460, textAlign: 'center' }}>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* G key hint */}
      {!isMobile && gPressed && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'rgba(6,6,18,0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 20px', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, animation: 'scaleIn 0.2s ease' }}>
          <span style={{ color: 'var(--accent-mid)' }}>g</span> +
          {NAV_ITEMS.map(n => <span key={n.key} style={{ opacity: 0.65 }}><span style={{ color: 'white', opacity: 1 }}>{n.key}</span></span>)}
        </div>
      )}

      {/* Shortcuts modal */}
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
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.04)', borderRadius: 10 }}>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{item.label}</span>
                  <div style={{ display: 'flex', gap: 5 }}><Kbd isDark={isDark}>g</Kbd><Kbd isDark={isDark}>{item.key}</Kbd></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isMobile && showUser && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowUser(false)} />}

      {/* Main content */}
      <main
        style={{ flex: 1, position: 'relative', zIndex: 1, paddingLeft: isMobile ? 0 : 88, paddingTop: isMobile ? 56 : 0, paddingBottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : 0, minWidth: 0 }}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <div key={pathname} className="page-enter" style={{ padding: isMobile ? '20px 16px' : '36px 44px', maxWidth: 1360, margin: '0 auto' }}>
          {mounted ? children : null}
        </div>
      </main>

      <style>{`
        @keyframes equBar1 { from { height: 3px; } to { height: 12px; } }
        @keyframes equBar2 { from { height: 6px; } to { height: 16px; } }
        @keyframes equBar3 { from { height: 3px; } to { height: 9px; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.94) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

function Kbd({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, padding: '2px 7px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
      {children}
    </span>
  )
}
