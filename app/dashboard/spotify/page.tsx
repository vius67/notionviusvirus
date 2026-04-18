'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  redirectToSpotify, exchangeCode, isConnected, disconnect,
  getPlayer, getRecent,
  cmdPlay, cmdPause, cmdNext, cmdPrev, cmdSeek, cmdVolume, cmdShuffle, cmdRepeat,
} from '@/lib/spotify'

type Track = {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  duration_ms: number
}
type PlayerState = {
  is_playing: boolean
  progress_ms: number
  item: Track | null
  shuffle_state: boolean
  repeat_state: 'off' | 'context' | 'track'
  device?: { volume_percent: number }
}
type RecentItem = { track: Track; played_at: string }

function msToTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function SpotifyPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [player, setPlayer] = useState<PlayerState | null>(null)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [localProgress, setLocalProgress] = useState(0)
  const [draggingSeek, setDraggingSeek] = useState(false)
  const [volume, setVolume] = useState(80)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)

  // Handle OAuth callback
  useEffect(() => {
    const code = params.get('code')
    const err = params.get('error')
    if (err) { setError('Spotify denied access.'); setLoading(false); return }
    if (code) {
      exchangeCode(code).then(ok => {
        if (ok) {
          router.replace('/dashboard/spotify')
          setConnected(true)
        } else {
          setError('Failed to connect. Try again.')
        }
        setLoading(false)
      })
      return
    }
    setConnected(isConnected())
    setLoading(false)
  }, [])

  // Fetch player state
  const fetchPlayer = useCallback(async () => {
    const [p, r] = await Promise.all([getPlayer(), getRecent()])
    if (p) {
      setPlayer(p)
      if (!draggingSeek) setLocalProgress(p.progress_ms)
      setVolume(p.device?.volume_percent ?? 80)
    }
    if (r?.items) setRecent(r.items)
  }, [draggingSeek])

  // Poll every 5s when connected
  useEffect(() => {
    if (!connected) return
    fetchPlayer()
    pollRef.current = setInterval(fetchPlayer, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [connected, fetchPlayer])

  // Tick progress locally between polls
  useEffect(() => {
    if (progressRef.current) clearInterval(progressRef.current)
    if (!player?.is_playing || draggingSeek) return
    progressRef.current = setInterval(() => {
      setLocalProgress(p => Math.min(p + 1000, player.item?.duration_ms ?? p))
    }, 1000)
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [player?.is_playing, player?.item?.id, draggingSeek])

  const doPlay  = async () => { await (player?.is_playing ? cmdPause() : cmdPlay()); fetchPlayer() }
  const doNext  = async () => { await cmdNext();  setTimeout(fetchPlayer, 600) }
  const doPrev  = async () => { await cmdPrev();  setTimeout(fetchPlayer, 600) }
  const doShuffle = async () => { await cmdShuffle(!player?.shuffle_state); fetchPlayer() }
  const doRepeat  = async () => {
    const next = { off: 'context', context: 'track', track: 'off' }[player?.repeat_state ?? 'off'] as string
    await cmdRepeat(next); fetchPlayer()
  }
  const onSeekEnd = async (ms: number) => {
    setDraggingSeek(false)
    await cmdSeek(ms)
    setPlayer(p => p ? { ...p, progress_ms: ms } : p)
  }
  const onVolumeChange = async (v: number) => {
    setVolume(v)
    await cmdVolume(v)
  }

  const track = player?.item
  const art = track?.album.images[0]?.url
  const pct = track ? (localProgress / track.duration_ms) * 100 : 0

  // ── Not connected ──────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid #1db954', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  if (!connected) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }} className="fade-up">
      <div style={{ width: 72, height: 72, borderRadius: 20, background: '#1db954', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(29,185,84,0.35)' }}>
        <SpotifyLogo size={38} />
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.03em' }}>Connect Spotify</h1>
      <p style={{ fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
        See what&apos;s playing, control playback, and browse your recent tracks — right from your dashboard.
      </p>
      {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</p>}
      <button
        onClick={redirectToSpotify}
        style={{ padding: '13px 32px', borderRadius: 50, background: '#1db954', border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif', boxShadow: '0 4px 20px rgba(29,185,84,0.4)', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 10 }}
      >
        <SpotifyLogo size={20} /> Connect with Spotify
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 20, opacity: 0.7 }}>
        Requires <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> in your environment
      </p>
    </div>
  )

  // ── Connected ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Music</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <SpotifyLogo size={24} color="#1db954" /> Spotify
          </h1>
        </div>
        <button
          onClick={() => { disconnect(); setConnected(false) }}
          className="glass-button"
          style={{ fontSize: 12.5, color: 'var(--text-muted)' }}
        >
          Disconnect
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>

        {/* Now playing */}
        <div className="glass-card fade-up" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
          {/* blurred art background */}
          {art && (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${art})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.07, filter: 'blur(40px)', transform: 'scale(1.2)', pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'relative' }}>
            {track ? (
              <>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 28 }}>
                  {/* Album art */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {art ? (
                      <img src={art} alt="album" width={130} height={130} style={{ borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', display: 'block' }} />
                    ) : (
                      <div style={{ width: 130, height: 130, borderRadius: 14, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SpotifyLogo size={40} color="#1db954" />
                      </div>
                    )}
                    {player?.is_playing && (
                      <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 2.5, alignItems: 'flex-end' }}>
                        {[1,2,3].map(i => (
                          <div key={i} style={{ width: 3, background: '#1db954', borderRadius: 2, animation: `equalize${i} 0.8s ease infinite alternate`, animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Track info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: player?.is_playing ? '#1db954' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      {player?.is_playing ? '▶ Now Playing' : '⏸ Paused'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 720, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.name}
                    </div>
                    <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.artists.map(a => a.name).join(', ')}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.album.name}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer', position: 'relative', marginBottom: 6 }}
                    onClick={e => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const ratio = (e.clientX - rect.left) / rect.width
                      const ms = Math.round(ratio * track.duration_ms)
                      setLocalProgress(ms)
                      onSeekEnd(ms)
                    }}
                    onMouseDown={() => setDraggingSeek(true)}
                  >
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #1db954, #1ed760)', borderRadius: 10, transition: draggingSeek ? 'none' : 'width 0.3s linear', position: 'relative' }}>
                      <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, borderRadius: '50%', background: '#1db954', boxShadow: '0 2px 8px rgba(29,185,84,0.5)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>
                    <span>{msToTime(localProgress)}</span>
                    <span>{msToTime(track.duration_ms)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 22 }}>
                  <CtrlBtn onClick={doShuffle} active={player?.shuffle_state}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                  </CtrlBtn>
                  <CtrlBtn onClick={doPrev}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 4h2v16H5z"/></svg>
                  </CtrlBtn>
                  <button
                    onClick={doPlay}
                    style={{ width: 54, height: 54, borderRadius: '50%', background: '#1db954', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(29,185,84,0.45)', transition: 'all 0.18s', color: 'white' }}
                  >
                    {player?.is_playing
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    }
                  </button>
                  <CtrlBtn onClick={doNext}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zM19 4h2v16h-2z"/></svg>
                  </CtrlBtn>
                  <CtrlBtn onClick={doRepeat} active={player?.repeat_state !== 'off'}>
                    {player?.repeat_state === 'track'
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="10" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                    }
                  </CtrlBtn>
                </div>

                {/* Volume */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>{volume > 0 && <path d="M15.54 8.46a5 5 0 010 7.07"/>}{volume > 50 && <path d="M19.07 4.93a10 10 0 010 14.14"/>}</svg>
                  <input
                    type="range" min={0} max={100} value={volume}
                    onChange={e => onVolumeChange(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#1db954', height: 4, cursor: 'pointer' }}
                  />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Nothing playing right now</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Open Spotify and start playing something</p>
              </div>
            )}
          </div>
        </div>

        {/* Recently played */}
        <div className="glass-card fade-up" style={{ padding: '18px 16px', animationDelay: '80ms' }}>
          <div style={{ fontSize: 12.5, fontWeight: 660, color: 'var(--text-primary)', marginBottom: 14 }}>Recently Played</div>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No history yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map((item, i) => {
                const t = item.track
                const img = t.album.images[t.album.images.length - 1]?.url
                const isNow = t.id === track?.id
                return (
                  <div key={`${t.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 10, background: isNow ? 'rgba(29,185,84,0.07)' : 'rgba(255,255,255,0.5)', border: `1px solid ${isNow ? 'rgba(29,185,84,0.2)' : 'rgba(255,255,255,0.75)'}`, transition: 'all 0.15s' }}>
                    {img ? (
                      <img src={img} alt="" width={36} height={36} style={{ borderRadius: 6, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(99,102,241,0.08)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 560, color: isNow ? '#1db954' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artists.map(a => a.name).join(', ')}</div>
                    </div>
                    {isNow && player?.is_playing && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1db954', flexShrink: 0, animation: 'pulse-dot 1.5s ease infinite' }} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes equalize1 { from { height: 4px; } to { height: 14px; } }
        @keyframes equalize2 { from { height: 8px; } to { height: 18px; } }
        @keyframes equalize3 { from { height: 4px; } to { height: 11px; } }
      `}</style>
    </div>
  )
}

function CtrlBtn({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ border: 'none', background: 'none', cursor: 'pointer', color: active ? '#1db954' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 6, borderRadius: 8, transition: 'all 0.15s', opacity: 0.85 }}
    >
      {children}
    </button>
  )
}

function SpotifyLogo({ size = 24, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}
