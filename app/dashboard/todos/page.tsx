'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import Modal from '@/components/Modal'

type Todo = { id: string; title: string; description: string | null; subject: string | null; due_date: string | null; priority: 'low'|'medium'|'high'|null; completed: boolean; status: string; created_at: string }
type KanbanCol = { id: string; label: string; color: string }

const SUBJECTS = ['Mathematics','English','Science','Physics','Chemistry','Biology','History','Geography','German','Enterprise Computing','PDHPE','Personal','Other']
const PRIOS = [{ v: 'high', label: 'High', color: '#ef4444' },{ v: 'medium', label: 'Medium', color: '#f59e0b' },{ v: 'low', label: 'Low', color: '#22c55e' }]
const COL_COLORS = ['#6366f1','#a78bfa','#f59e0b','#ef4444','#34d399','#ec4899','#3b82f6','#f97316']

const DEFAULT_COLS: KanbanCol[] = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done',        label: 'Done',        color: '#22c55e' },
]

const emptyForm = { title: '', description: '', subject: '', due_date: '', priority: 'medium' as 'low'|'medium'|'high' }

function loadCols(): KanbanCol[] {
  if (typeof window === 'undefined') return DEFAULT_COLS
  try {
    const saved = localStorage.getItem('beam_kanban_cols')
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_COLS
}

export default function TodosPage() {
  const { user } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list'|'kanban'>('list')
  const [filter, setFilter] = useState<'all'|'today'|'high'|'done'>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [inlineTitle, setInlineTitle] = useState('')
  const [showInline, setShowInline] = useState(false)
  const [dragging, setDragging] = useState<string|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)
  const [cols, setCols] = useState<KanbanCol[]>(DEFAULT_COLS)
  const [editingColId, setEditingColId] = useState<string|null>(null)
  const [editingColLabel, setEditingColLabel] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColColor, setNewColColor] = useState(COL_COLORS[0])
  const [defaultColId, setDefaultColId] = useState('todo')
  const newColInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setCols(loadCols()) }, [])
  useEffect(() => { if (user) load() }, [user])

  const persistCols = (next: KanbanCol[]) => {
    setCols(next)
    localStorage.setItem('beam_kanban_cols', JSON.stringify(next))
  }

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('todos').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setTodos((data || []).map((t: any) => ({ ...t, status: t.status || (t.completed ? 'done' : 'todo') })))
    setLoading(false)
  }

  const save = async () => {
    if (!user || !form.title.trim()) return
    setSaving(true)
    await supabase.from('todos').insert({ ...form, user_id: user.id, completed: false, status: defaultColId })
    setForm(emptyForm); setShowModal(false); setSaving(false); load()
  }

  const quickAdd = async () => {
    if (!user || !inlineTitle.trim()) return
    await supabase.from('todos').insert({ title: inlineTitle, user_id: user.id, completed: false, priority: 'medium', status: 'todo' })
    setInlineTitle(''); setShowInline(false); load()
  }

  const toggle = async (id: string, current: boolean) => {
    const newStatus = !current ? 'done' : 'todo'
    await supabase.from('todos').update({ completed: !current, status: newStatus }).eq('id', id)
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !current, status: newStatus } : t))
  }

  const del = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    setTodos(todos.filter(t => t.id !== id))
  }

  const moveStatus = async (id: string, status: string) => {
    const isLastDoneCol = status === 'done' || cols.find(c => c.id === status)?.label.toLowerCase().includes('done')
    const completed = status === 'done'
    await supabase.from('todos').update({ status, completed }).eq('id', id)
    setTodos(todos.map(t => t.id === id ? { ...t, status, completed } : t))
  }

  const addCol = () => {
    if (!newColLabel.trim()) return
    const id = `col_${Date.now()}`
    persistCols([...cols, { id, label: newColLabel.trim(), color: newColColor }])
    setNewColLabel(''); setAddingCol(false); setNewColColor(COL_COLORS[0])
  }

  const deleteCol = (id: string) => {
    if (cols.length <= 1) return
    persistCols(cols.filter(c => c.id !== id))
    if (defaultColId === id) setDefaultColId(cols.find(c => c.id !== id)?.id || 'todo')
  }

  const startRename = (col: KanbanCol) => {
    setEditingColId(col.id)
    setEditingColLabel(col.label)
  }

  const commitRename = () => {
    if (!editingColId || !editingColLabel.trim()) { setEditingColId(null); return }
    persistCols(cols.map(c => c.id === editingColId ? { ...c, label: editingColLabel.trim() } : c))
    setEditingColId(null)
  }

  const today = new Date().toISOString().split('T')[0]
  const filtered = todos.filter(t => {
    if (filter === 'done')  return t.completed
    if (filter === 'today') return !t.completed && t.due_date === today
    if (filter === 'high')  return !t.completed && t.priority === 'high'
    return !t.completed
  })

  const prioColor = (p: string|null) => p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Tasks</p>
          <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>To-do</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{todos.filter(t => !t.completed).length} remaining</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.68)', border: '1px solid rgba(200,210,240,0.5)', borderRadius: 12, padding: 3 }}>
            {(['list','kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: view === v ? 'white' : 'transparent', color: view === v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: view === v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
                {v === 'list' ? 'List' : 'Board'}
              </button>
            ))}
          </div>
          <button className="glass-button-primary" onClick={() => setShowModal(true)}>+ Add task</button>
        </div>
      </div>

      {/* Filters (list only) */}
      {view === 'list' && (
        <div className="fade-up" style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
          {([{k:'all',l:'All'},{k:'today',l:'Today'},{k:'high',l:'High priority'},{k:'done',l:'Done'}] as const).map(f => (
            <button key={f.k} onClick={() => setFilter(f.k as any)} style={{ padding: '6px 16px', borderRadius: 9, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Geist, sans-serif', transition: 'all 0.2s', background: filter === f.k ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.68)', borderColor: filter === f.k ? 'rgba(99,102,241,0.3)' : 'rgba(200,210,240,0.5)', color: filter === f.k ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
              {f.l}
            </button>
          ))}
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            {showInline ? (
              <div className="glass-card fade-up" style={{ padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <input className="glass-input" value={inlineTitle} onChange={e => setInlineTitle(e.target.value)} placeholder="Task name…" autoFocus onKeyDown={e => { if (e.key === 'Enter') quickAdd(); if (e.key === 'Escape') setShowInline(false) }} style={{ flex: 1 }} />
                <button className="glass-button-primary" onClick={quickAdd} style={{ padding: '8px 14px', whiteSpace: 'nowrap', fontSize: 13 }}>Add</button>
                <button className="glass-button" onClick={() => setShowInline(false)} style={{ padding: '8px 12px', fontSize: 13 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowInline(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, border: '1.5px dashed rgba(99,102,241,0.22)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13.5, transition: 'all 0.2s', width: '100%', fontFamily: 'Geist, sans-serif' }}>
                <span style={{ fontSize: 18, color: 'var(--accent)', lineHeight: 1 }}>+</span> Add a task…
              </button>
            )}
          </div>

          {loading
            ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
            : filtered.length === 0
              ? <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Nothing here 🎉</div>
              : <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filtered.map((t, i) => (
                    <div key={t.id} className="glass-card fade-up" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 30}ms` }}>
                      <div className={`custom-checkbox ${t.completed ? 'checked' : ''}`} onClick={() => toggle(t.id, t.completed)} style={{ borderColor: t.priority === 'high' ? 'rgba(239,68,68,0.4)' : undefined }}>
                        {t.completed && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.2 5.8L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 510, color: t.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          {t.subject && <span className="subject-tag">{t.subject}</span>}
                          {t.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(t.due_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>}
                          {t.description && <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.description}</span>}
                        </div>
                      </div>
                      {t.priority && <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: prioColor(t.priority), boxShadow: `0 0 6px ${prioColor(t.priority)}66` }} />}
                      <button onClick={() => del(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, opacity: 0.4, transition: 'opacity 0.15s', fontSize: 16 }}>✕</button>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* KANBAN / BOARD VIEW */}
      {view === 'kanban' && (
        <div>
          <div className="fade-up" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 16 }}>
            {cols.map(col => {
              const colTodos = todos.filter(t => (t.status || (t.completed ? 'done' : 'todo')) === col.id)
              return (
                <div
                  key={col.id}
                  className={`kanban-col ${dragOver === col.id ? 'drag-over' : ''}`}
                  style={{ minWidth: 260, width: 260, flexShrink: 0 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => { e.preventDefault(); if (dragging) moveStatus(dragging, col.id); setDragOver(null) }}
                >
                  {/* Col header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 3, background: col.color, boxShadow: `0 0 6px ${col.color}88`, flexShrink: 0 }} />
                    {editingColId === col.id ? (
                      <input
                        value={editingColLabel}
                        onChange={e => setEditingColLabel(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingColId(null) }}
                        autoFocus
                        style={{ flex: 1, fontSize: 13, fontWeight: 640, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Geist, sans-serif', color: 'var(--text-primary)', borderBottom: '1.5px solid var(--accent)' }}
                      />
                    ) : (
                      <span
                        style={{ fontSize: 13, fontWeight: 640, color: 'var(--text-primary)', flex: 1, cursor: 'text' }}
                        onDoubleClick={() => startRename(col)}
                        title="Double-click to rename"
                      >{col.label}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.65)', padding: '1px 7px', borderRadius: 6, fontWeight: 500 }}>{colTodos.length}</span>
                    {cols.length > 1 && (
                      <button onClick={() => deleteCol(col.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, opacity: 0.4, fontSize: 14, transition: 'opacity 0.15s', flexShrink: 0 }} title="Delete column">✕</button>
                    )}
                  </div>

                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
                    {colTodos.map((t, i) => (
                      <div
                        key={t.id}
                        className="kanban-card"
                        draggable
                        onDragStart={() => setDragging(t.id)}
                        onDragEnd={() => { setDragging(null); setDragOver(null) }}
                        style={{ opacity: dragging === t.id ? 0.45 : 1, animation: `fadeUp 0.3s ease ${i * 40}ms both` }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 530, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{t.title}</span>
                          <button onClick={() => del(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.35, fontSize: 14, flexShrink: 0 }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
                          {t.subject && <span className="subject-tag">{t.subject}</span>}
                          {t.priority && <div style={{ width: 6, height: 6, borderRadius: '50%', background: prioColor(t.priority), boxShadow: `0 0 5px ${prioColor(t.priority)}88`, flexShrink: 0 }} />}
                          {t.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{new Date(t.due_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setDefaultColId(col.id); setShowModal(true) }}
                    style={{ marginTop: 12, width: '100%', padding: '9px', border: '1.5px dashed rgba(99,102,241,0.2)', borderRadius: 11, background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'Geist, sans-serif', transition: 'all 0.18s' }}
                  >
                    + Add task
                  </button>
                </div>
              )
            })}

            {/* Add column */}
            {addingCol ? (
              <div className="kanban-col" style={{ minWidth: 230, width: 230, flexShrink: 0 }}>
                <div style={{ marginBottom: 10 }}>
                  <input
                    ref={newColInputRef}
                    className="glass-input"
                    value={newColLabel}
                    onChange={e => setNewColLabel(e.target.value)}
                    placeholder="Column name…"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') addCol(); if (e.key === 'Escape') setAddingCol(false) }}
                    style={{ fontSize: 13, marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                    {COL_COLORS.map(c => (
                      <div key={c} onClick={() => setNewColColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', outline: newColColor === c ? `2.5px solid ${c}` : 'none', outlineOffset: 2, transform: newColColor === c ? 'scale(1.18)' : 'scale(1)', transition: 'all 0.15s' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button className="glass-button-primary" onClick={addCol} style={{ flex: 1, padding: '7px', fontSize: 12.5 }}>Add</button>
                    <button className="glass-button" onClick={() => { setAddingCol(false); setNewColLabel('') }} style={{ padding: '7px 12px', fontSize: 12.5 }}>✕</button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setAddingCol(true)}
                style={{ minWidth: 50, width: 50, flexShrink: 0, borderRadius: 'var(--radius)', border: '1.5px dashed rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, transition: 'all 0.2s', minHeight: 80 }}
                title="Add column"
              >
                +
              </div>
            )}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            💡 Drag cards between columns · Double-click a column name to rename it
          </p>
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Task">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Task name *</label>
            <input className="glass-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="What needs to be done?" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea className="glass-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional details…" rows={2} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Subject</label>
              <select className="glass-input" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                <option value="">None</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Due date</label>
              <input className="glass-input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Priority</label>
              <select className="glass-input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})}>
                {PRIOS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="glass-button" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="glass-button-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Adding…' : 'Add task'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
