'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const SUBJECTS = ['Mathematics','English','Science','Physics','Chemistry','Biology','History','Geography','German','Enterprise Computing','PDHPE','Other']
const PRESETS = [
  { label: '25', desc: 'Pomodoro', mins: 25 },
  { label: '45', desc: 'Deep work', mins: 45 },
  { label: '60', desc: '1 hour', mins: 60 },
  { label: '90', desc: 'Flow', mins: 90 },
]

export default function TimerPage() {
  const { user } = useAuth()
  const [totalSecs, setTotalSecs] = useState(25 * 60)
  const [secsLeft, setSecsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [subject, setSubject] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [completed, setCompleted] = useState(false)
  const [customMins, setCustomMins] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { loadSessions() }, [user])

  const loadSessions = async () => {
    if (!user) return
    const { data } = await supabase.from('study_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    setSessions(data || [])
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecsLeft(s => {
          if (s <= 1) { clearInterval(intervalRef.current!); setRunning(false); setCompleted(true); saveSession(Math.round(totalSecs / 60)); return 0 }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const saveSession = async (mins: number) => {
    if (!user) return
    await supabase.from('study_sessions').insert({ user_id: user.id, subject: subject || null, duration_minutes: mins })
    loadSessions()
  }

  const setPreset = (mins: number) => {
    if (running) return
    setTotalSecs(mins * 60); setSecsLeft(mins * 60); setCompleted(false)
  }

  const reset = () => { setRunning(false); setSecsLeft(totalSecs); setCompleted(false) }

  const stopEarly = async () => {
    setRunning(false)
    const elapsed = Math.round((totalSecs - secsLeft) / 60)
    if (elapsed >= 1) await saveSession(elapsed)
    setSecsLeft(totalSecs); setCompleted(false)
  }

  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const progress = (totalSecs - secsLeft) / totalSecs
  const r = 130
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - progress)

  const totalStudied = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
  const todaySessions = sessions.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString())
  const todayMins = todaySessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)

  const ringColor = completed ? '#22c55e' : running ? 'url(#timerGrad)' : 'rgba(99,102,241,0.3)'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <p className="page-eyebrow">Focus</p>
        <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Study Timer</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
          {Math.floor(totalStudied/60)}h {totalStudied%60}m total · {todayMins}m today
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Timer card */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(15,15,35,0.96) 0%, rgba(20,20,50,0.94) 100%)',
          backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 28,
          padding: '44px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: running
            ? '0 0 80px rgba(99,102,241,0.25), 0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 20px 60px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
          transition: 'box-shadow 1s ease',
          animation: 'fade-up 0.5s ease both',
        }}>

          {/* Preset tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 44, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4 }}>
            {PRESETS.map(p => {
              const active = totalSecs === p.mins * 60
              return (
                <button key={p.mins} onClick={() => setPreset(p.mins)} disabled={running} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: active ? 'rgba(99,102,241,0.85)' : 'transparent', color: active ? 'white' : 'rgba(255,255,255,0.4)', boxShadow: active ? '0 4px 16px rgba(99,102,241,0.4)' : 'none', opacity: running && !active ? 0.4 : 1 }}>
                  <div style={{ fontSize: 14 }}>{p.label}m</div>
                  <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{p.desc}</div>
                </button>
              )
            })}
            <button onClick={() => setShowCustom(s => !s)} disabled={running} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'rgba(255,255,255,0.35)', transition: 'all 0.15s', opacity: running ? 0.4 : 1 }}>
              ···
            </button>
          </div>

          {/* Custom duration input */}
          {showCustom && !running && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 28, animation: 'fadeUp 0.2s ease' }}>
              <input className="glass-input" type="number" value={customMins} onChange={e => setCustomMins(e.target.value)} placeholder="Minutes" min="1" max="240" style={{ width: 120, textAlign: 'center', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }} onKeyDown={e => e.key === 'Enter' && customMins && setPreset(parseInt(customMins))} />
              <button className="glass-button" onClick={() => customMins && setPreset(parseInt(customMins))} style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}>Set</button>
            </div>
          )}

          {/* Ring */}
          <div style={{ position: 'relative', marginBottom: 36 }}>
            {/* Glow when running */}
            {running && <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', animation: 'pulse-dot 2s ease infinite', pointerEvents: 'none' }} />}

            <svg width={300} height={300} style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#f87171" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Track */}
              <circle cx={150} cy={150} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
              {/* Progress */}
              {progress > 0 && (
                <circle cx={150} cy={150} r={r} fill="none"
                  stroke={completed ? '#22c55e' : 'url(#timerGrad)'}
                  strokeWidth={10} strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  filter={running ? 'url(#glow)' : undefined}
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                />
              )}
            </svg>

            {/* Center content */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              {completed ? (
                <>
                  <div style={{ fontSize: 44 }}>🎉</div>
                  <div style={{ fontSize: 16, fontWeight: 660, color: '#22c55e', marginTop: 8 }}>Session complete!</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{Math.round(totalSecs/60)} min logged</div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 58, fontWeight: 300, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
                  </div>
                  {subject && (
                    <div style={{ marginTop: 12, padding: '4px 14px', background: 'rgba(99,102,241,0.25)', borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{subject}</div>
                  )}
                  {running && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#818cf8', animation: `pulse-dot 1.2s ease ${i * 200}ms infinite` }} />)}
                    </div>
                  )}
                  {!running && !subject && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 10 }}>ready to focus</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Subject selector */}
          {!running && !completed && (
            <div style={{ marginBottom: 24, width: '100%', maxWidth: 280 }}>
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: subject ? 'white' : 'rgba(255,255,255,0.35)', fontFamily: 'Geist, sans-serif', fontSize: 13.5, outline: 'none', cursor: 'pointer', appearance: 'none', textAlign: 'center' }}>
                <option value="" style={{ background: '#1a1a2e', color: '#94a3b8' }}>Select subject (optional)</option>
                {SUBJECTS.map(s => <option key={s} value={s} style={{ background: '#1a1a2e', color: 'white' }}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {!completed && (
              <button onClick={() => setRunning(!running)} style={{ padding: '14px 44px', borderRadius: 16, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 15, fontWeight: 620, transition: 'all 0.22s', background: running ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #6366f1, #a78bfa)', color: 'white', boxShadow: running ? 'none' : '0 6px 24px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                {running ? '⏸ Pause' : secsLeft < totalSecs ? '▶ Resume' : '▶ Start'}
              </button>
            )}
            {(running || (secsLeft < totalSecs && !completed)) && (
              <button onClick={stopEarly} style={{ padding: '14px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13.5, fontWeight: 500, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', transition: 'all 0.18s' }}>Stop & save</button>
            )}
            {(completed || secsLeft < totalSecs) && (
              <button onClick={reset} style={{ padding: '14px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13.5, fontWeight: 500, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', transition: 'all 0.18s' }}>Reset</button>
            )}
          </div>
        </div>

        {/* Right column: stats + session log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stats */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 640, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>This session</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Today', value: `${todayMins}m`, color: '#6366f1' },
                { label: 'Sessions', value: String(todaySessions.length), color: '#a78bfa' },
                { label: 'All time', value: `${Math.floor(totalStudied/60)}h`, color: '#34d399' },
                { label: 'Total', value: String(sessions.length), color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.55)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.8)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Session log */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 640, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '-0.01em' }}>Recent sessions</h2>
            {sessions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No sessions yet — start studying! 📚</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {sessions.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'rgba(255,255,255,0.5)', borderRadius: 11, border: '1px solid rgba(255,255,255,0.7)', animation: `fadeUp 0.25s ease ${i * 25}ms both` }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(167,139,250,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>⏱</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 560, color: 'var(--text-primary)' }}>{s.duration_minutes} min</div>
                      {s.subject && <span className="subject-tag" style={{ marginTop: 2, display: 'inline-block', fontSize: 10 }}>{s.subject}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
