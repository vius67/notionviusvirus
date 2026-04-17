'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'German', 'Enterprise Computing', 'PDHPE', 'Other']

const PRESETS = [
  { label: '25 min', desc: 'Pomodoro', mins: 25 },
  { label: '45 min', desc: 'Deep work', mins: 45 },
  { label: '60 min', desc: 'Long session', mins: 60 },
  { label: '90 min', desc: 'Flow state', mins: 90 },
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
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            setCompleted(true)
            saveSession(Math.round(totalSecs / 60))
            return 0
          }
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
    setTotalSecs(mins * 60)
    setSecsLeft(mins * 60)
    setCompleted(false)
  }

  const reset = () => {
    setRunning(false)
    setSecsLeft(totalSecs)
    setCompleted(false)
  }

  const stopEarly = async () => {
    setRunning(false)
    const elapsed = Math.round((totalSecs - secsLeft) / 60)
    if (elapsed >= 1) await saveSession(elapsed)
    setSecsLeft(totalSecs)
    setCompleted(false)
  }

  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const progress = ((totalSecs - secsLeft) / totalSecs) * 100
  const circumference = 2 * Math.PI * 120

  const totalStudied = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Study Timer</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{Math.floor(totalStudied / 60)}h {totalStudied % 60}m studied total</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Timer */}
        <div className="glass-card" style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PRESETS.map(p => (
              <button key={p.mins} onClick={() => setPreset(p.mins)} disabled={running} style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid', cursor: running ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
                background: totalSecs === p.mins * 60 ? 'rgba(123,158,240,0.18)' : 'rgba(255,255,255,0.5)',
                borderColor: totalSecs === p.mins * 60 ? 'rgba(123,158,240,0.4)' : 'rgba(255,255,255,0.7)',
                color: totalSecs === p.mins * 60 ? 'var(--accent-deep)' : 'var(--text-secondary)',
                opacity: running ? 0.6 : 1
              }}>
                <div>{p.label}</div>
                <div style={{ fontSize: 10, color: 'inherit', opacity: 0.7 }}>{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Circle timer */}
          <div style={{ position: 'relative', marginBottom: 32 }}>
            <svg width={280} height={280} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={140} cy={140} r={120} fill="none" stroke="rgba(123,158,240,0.1)" strokeWidth={8} />
              <circle cx={140} cy={140} r={120} fill="none" stroke={completed ? '#22c55e' : running ? '#7B9EF0' : 'rgba(123,158,240,0.35)'}
                strokeWidth={8} strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * progress / 100)}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {completed ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36 }}>🎉</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#22c55e', marginTop: 6 }}>Done!</div>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 52, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </div>
                  {subject && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{subject}</div>}
                  {running && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7B9EF0', marginTop: 10, animation: 'pulse 1.5s ease infinite' }} />}
                </>
              )}
            </div>
          </div>

          {/* Subject */}
          {!running && !completed && (
            <div style={{ marginBottom: 20, width: '100%', maxWidth: 260 }}>
              <select className="glass-input" value={subject} onChange={e => setSubject(e.target.value)} style={{ textAlign: 'center' }}>
                <option value="">Select subject (optional)</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {!completed && (
              <button className="glass-button-primary" onClick={() => setRunning(!running)} style={{ padding: '12px 36px', fontSize: 15 }}>
                {running ? '⏸ Pause' : secsLeft < totalSecs ? '▶ Resume' : '▶ Start'}
              </button>
            )}
            {(running || secsLeft < totalSecs) && !completed && (
              <button className="glass-button" onClick={stopEarly} style={{ padding: '12px 20px', fontSize: 14 }}>Stop & save</button>
            )}
            {(completed || secsLeft < totalSecs) && (
              <button className="glass-button" onClick={reset} style={{ padding: '12px 20px', fontSize: 14 }}>Reset</button>
            )}
          </div>

          {/* Custom */}
          {!running && (
            <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="glass-input" type="number" value={customMins} onChange={e => setCustomMins(e.target.value)} placeholder="Custom mins" style={{ width: 120, textAlign: 'center' }} min="1" max="240" />
              <button className="glass-button" onClick={() => { if (customMins) setPreset(parseInt(customMins)) }}>Set</button>
            </div>
          )}
        </div>

        {/* Session log */}
        <div className="glass-card" style={{ padding: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Session log</h2>
          {sessions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>No sessions yet — start studying!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.5)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.7)', animation: `fadeIn 0.25s ease ${i * 0.03}s both` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(123,158,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⏱</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.duration_minutes} min</div>
                    {s.subject && <span className="subject-tag" style={{ marginTop: 2, display: 'inline-block' }}>{s.subject}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}`}</style>
    </div>
  )
}
