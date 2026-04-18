'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import Modal from '@/components/Modal'

type HW = { id: string; title: string; subject: string|null; due_date: string|null; notes: string|null; completed: boolean; created_at: string }
const SUBJECTS = ['Mathematics','English','Science','Physics','Chemistry','Biology','History','Geography','German','Enterprise Computing','PDHPE','Other']

export default function HomeworkPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<HW[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'pending'|'all'|'done'>('pending')
  const [form, setForm] = useState({ title: '', subject: '', due_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string|null>(null)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('homework').select('*').eq('user_id', user.id).order('due_date', { ascending: true, nullsFirst: false })
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const save = async () => {
    if (!user || !form.title.trim()) return
    setSaving(true)
    await supabase.from('homework').insert({ ...form, user_id: user.id, completed: false })
    setForm({ title: '', subject: '', due_date: '', notes: '' })
    setShowModal(false); setSaving(false); load()
  }

  const toggle = async (id: string, cur: boolean) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed: !cur } : i))
    await supabase.from('homework').update({ completed: !cur }).eq('id', id)
  }

  const del = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('homework').delete().eq('id', id)
  }

  const filtered = items.filter(i => filter === 'all' ? true : filter === 'pending' ? !i.completed : i.completed)
  const total = items.length
  const done = items.filter(i => i.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const getDue = (due: string|null) => {
    if (!due) return null
    const diff = Math.ceil((new Date(due + 'T00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0)  return { label: 'Overdue',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (diff === 0) return { label: 'Today',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' }
    if (diff <= 3)  return { label: `${diff}d`, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' }
    return { label: `${diff}d`, color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.08)' }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Tracker</p>
          <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Homework</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{items.filter(i => !i.completed).length} pending · {done} done</p>
        </div>
        <button className="glass-button-primary fade-up" onClick={() => setShowModal(true)} style={{ marginTop: 6 }}>+ Add homework</button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="glass-card fade-up" style={{ padding: '18px 22px', marginBottom: 20, animationDelay: '40ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 560, color: 'var(--text-primary)' }}>Overall progress</span>
            <span style={{ fontSize: 13, fontWeight: 660, color: 'var(--accent)' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(99,102,241,0.1)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg, #34d399, #22c55e)' : 'linear-gradient(90deg, #6366f1, #a78bfa)', borderRadius: 10, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
            <span>{done} completed</span>
            <span>{total - done} remaining</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="fade-up" style={{ display: 'flex', gap: 7, marginBottom: 16, animationDelay: '60ms' }}>
        {(['pending','all','done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 9, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Geist, sans-serif', transition: 'all 0.2s', background: filter === f ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.68)', borderColor: filter === f ? 'rgba(99,102,241,0.3)' : 'rgba(200,210,240,0.5)', color: filter === f ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, animationDelay: `${i * 60}ms` }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: 52, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 520 }}>{filter === 'pending' ? 'No pending homework!' : 'Nothing here'}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {filter === 'pending' ? 'Enjoy the free time 🎉' : 'Add some homework to get started'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((hw, i) => {
            const due = getDue(hw.due_date)
            const isExpanded = expanded === hw.id
            return (
              <div
                key={hw.id}
                className="glass-card fade-up"
                style={{ padding: 0, overflow: 'hidden', animationDelay: `${i * 35}ms`, cursor: 'pointer' }}
                onClick={() => setExpanded(isExpanded ? null : hw.id)}
              >
                {/* Main row */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    className={`custom-checkbox ${hw.completed ? 'checked' : ''}`}
                    onClick={e => { e.stopPropagation(); toggle(hw.id, hw.completed) }}
                  >
                    {hw.completed && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.2 5.8L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 530, color: hw.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: hw.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hw.title}</div>
                    <div style={{ display: 'flex', gap: 7, marginTop: 4, alignItems: 'center' }}>
                      {hw.subject && <span className="subject-tag">{hw.subject}</span>}
                      {hw.due_date && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{new Date(hw.due_date + 'T00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>}
                      {hw.notes && <span style={{ fontSize: 11, color: 'var(--accent-mid)', opacity: 0.7 }}>📝 has notes</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {due && <span style={{ fontSize: 12, color: due.color, fontWeight: 600, background: due.bg, padding: '3px 9px', borderRadius: 7 }}>{due.label}</span>}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
                    <button onClick={e => { e.stopPropagation(); del(hw.id) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, opacity: 0.4, padding: 4, transition: 'opacity 0.15s' }}>✕</button>
                  </div>
                </div>

                {/* Expanded notes */}
                {isExpanded && (
                  <div style={{ padding: '0 18px 16px 56px', animation: 'fadeUp 0.2s ease', borderTop: '1px solid rgba(99,102,241,0.06)' }}>
                    {hw.notes ? (
                      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 12 }}>{hw.notes}</p>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 12 }}>No notes added</p>
                    )}
                    {hw.due_date && (() => {
                      const diff = Math.ceil((new Date(hw.due_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
                      return diff >= 0 ? (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Time remaining</span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{diff} day{diff !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(99,102,241,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, 100 - (diff / 14) * 100))}%`, background: diff <= 1 ? '#ef4444' : diff <= 3 ? '#f59e0b' : '#6366f1', borderRadius: 4, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Homework">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Task *</label>
            <input className="glass-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Chapter 5 questions" autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Subject</label>
              <select className="glass-input" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                <option value="">Select…</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Due date</label>
              <input className="glass-input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea className="glass-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any details, page numbers, instructions…" rows={2} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="glass-button" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="glass-button-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Add'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
