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
    await supabase.from('homework').update({ completed: !cur }).eq('id', id)
    setItems(items.map(i => i.id === id ? { ...i, completed: !cur } : i))
  }

  const del = async (id: string) => {
    await supabase.from('homework').delete().eq('id', id)
    setItems(items.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => filter === 'all' ? true : filter === 'pending' ? !i.completed : i.completed)

  const getDue = (due: string|null) => {
    if (!due) return null
    const d = new Date(due)
    const diff = Math.ceil((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0)  return { label: 'Overdue',  color: '#ef4444' }
    if (diff === 0) return { label: 'Today',   color: '#f59e0b' }
    if (diff === 1) return { label: 'Tomorrow',color: '#f59e0b' }
    return { label: `${diff}d`, color: 'var(--text-muted)' }
  }

  return (
    <div>
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Tracker</p>
          <h1 style={{ fontSize: 26, fontWeight: 650, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Homework</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{items.filter(i => !i.completed).length} tasks pending</p>
        </div>
        <button className="glass-button-primary fade-up" onClick={() => setShowModal(true)} style={{ marginTop: 6 }}>+ Add homework</button>
      </div>

      <div className="fade-up" style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
        {(['pending','all','done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Geist, sans-serif', transition: 'all 0.18s', background: filter === f ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.6)', borderColor: filter === f ? 'rgba(99,102,241,0.3)' : 'rgba(200,210,240,0.5)', color: filter === f ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        : filtered.length === 0
          ? <div className="glass-card" style={{ padding: 44, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              {filter === 'pending' ? 'No pending homework!' : 'Nothing here'}
            </div>
          : <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {filtered.map((hw, i) => {
                const due = getDue(hw.due_date)
                return (
                  <div key={hw.id} className="glass-card fade-up" style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i*40}ms` }}>
                    <div className={`custom-checkbox ${hw.completed ? 'checked' : ''}`} onClick={() => toggle(hw.id, hw.completed)}>
                      {hw.completed && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.2 5.8L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 520, color: hw.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: hw.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hw.title}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        {hw.subject && <span className="subject-tag">{hw.subject}</span>}
                        {hw.notes && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{hw.notes}</span>}
                      </div>
                    </div>
                    {due && <span style={{ fontSize: 12, color: due.color, fontWeight: 570, whiteSpace: 'nowrap', flexShrink: 0 }}>{due.label}</span>}
                    {hw.due_date && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(hw.due_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>}
                    <button onClick={() => del(hw.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, opacity: 0.5, padding: 4, transition: 'opacity 0.15s' }}>✕</button>
                  </div>
                )
              })}
            </div>
      }

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Homework">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Task *</label>
            <input className="glass-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Chapter 5 questions" autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Subject</label>
              <select className="glass-input" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                <option value="">Select…</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Due date</label>
              <input className="glass-input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea className="glass-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any details…" rows={2} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="glass-button" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="glass-button-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Add task'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
