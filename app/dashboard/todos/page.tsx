'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type Todo = { id: string; title: string; description: string | null; subject: string | null; due_date: string | null; priority: 'low'|'medium'|'high'|null; completed: boolean; status: string; created_at: string }
type KanbanCol = { id: string; label: string; color: string }

const SUBJECTS = ['Mathematics','English','Science','Physics','Chemistry','Biology','History','Geography','German','Enterprise Computing','PDHPE','Personal','Other']
const PRIOS = [{ v: 'high', label: 'High', color: '#ef4444' },{ v: 'medium', label: 'Medium', color: '#f59e0b' },{ v: 'low', label: 'Low', color: '#22c55e' }]
const COL_COLORS = ['#6366f1','#a78bfa','#f59e0b','#ef4444','#34d399','#f87171','#3b82f6','#f97316']

const DEFAULT_COLS: KanbanCol[] = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done',        label: 'Done',        color: '#22c55e' },
]

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
  const [cols, setCols] = useState<KanbanCol[]>(DEFAULT_COLS)
  const [dragging, setDragging] = useState<string|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)
  const [editingColId, setEditingColId] = useState<string|null>(null)
  const [editingColLabel, setEditingColLabel] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColColor, setNewColColor] = useState(COL_COLORS[0])
  // Inline adding
  const [inlineColId, setInlineColId] = useState<string|null>(null)
  const [inlineTitle, setInlineTitle] = useState('')
  const [listInlineTitle, setListInlineTitle] = useState('')
  const [showListInline, setShowListInline] = useState(false)
  const inlineRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setCols(loadCols()) }, [])
  useEffect(() => { if (user) load() }, [user])
  useEffect(() => { if (inlineColId && inlineRef.current) inlineRef.current.focus() }, [inlineColId])

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

  const toggle = async (id: string, current: boolean) => {
    const newStatus = !current ? 'done' : cols[0]?.id || 'todo'
    const prev = todos.find(t => t.id === id)
    setTodos(ps => ps.map(t => t.id === id ? { ...t, completed: !current, status: newStatus } : t))
    const { error } = await supabase.from('todos').update({ completed: !current, status: newStatus }).eq('id', id)
    if (error) {
      console.error('toggle error:', error)
      if (prev) setTodos(ps => ps.map(t => t.id === id ? prev : t))
    }
  }

  const del = async (id: string) => {
    const prev = todos.find(t => t.id === id)
    setTodos(ps => ps.filter(t => t.id !== id))
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) {
      console.error('delete error:', error)
      if (prev) setTodos(ps => [prev, ...ps])
    }
  }

  const moveStatus = async (id: string, status: string) => {
    const completed = status === 'done'
    const prev = todos.find(t => t.id === id)
    setTodos(ps => ps.map(t => t.id === id ? { ...t, status, completed } : t))
    const { error } = await supabase.from('todos').update({ status, completed }).eq('id', id)
    if (error) {
      console.error('moveStatus error:', error)
      if (prev) setTodos(ps => ps.map(t => t.id === id ? prev : t))
    }
  }

  // Kanban inline add
  const addKanbanTask = async (colId: string) => {
    if (!inlineTitle.trim() || !user) { setInlineColId(null); setInlineTitle(''); return }
    const tempId = `temp_${Date.now()}`
    const optimistic: Todo = { id: tempId, title: inlineTitle.trim(), description: null, subject: null, due_date: null, priority: 'medium', completed: false, status: colId, created_at: new Date().toISOString() }
    setTodos(prev => [optimistic, ...prev])
    setInlineTitle(''); setInlineColId(null)
    const { data, error } = await supabase
      .from('todos')
      .insert({ title: optimistic.title, user_id: user.id, completed: false, priority: 'medium', status: colId })
      .select()
      .single()
    if (error) {
      console.error('addKanbanTask error:', error)
      setTodos(prev => prev.filter(t => t.id !== tempId))
    } else if (data) {
      setTodos(prev => prev.map(t => t.id === tempId ? { ...data, status: data.status || colId } : t))
    }
  }

  // List inline add
  const addListTask = async () => {
    if (!listInlineTitle.trim() || !user) { setShowListInline(false); setListInlineTitle(''); return }
    const firstColId = cols[0]?.id || 'todo'
    const tempId = `temp_${Date.now()}`
    const optimistic: Todo = { id: tempId, title: listInlineTitle.trim(), description: null, subject: null, due_date: null, priority: 'medium', completed: false, status: firstColId, created_at: new Date().toISOString() }
    setTodos(prev => [optimistic, ...prev])
    setListInlineTitle(''); setShowListInline(false)
    const { data, error } = await supabase
      .from('todos')
      .insert({ title: optimistic.title, user_id: user.id, completed: false, priority: 'medium', status: firstColId })
      .select()
      .single()
    if (error) {
      console.error('addListTask error:', error)
      setTodos(prev => prev.filter(t => t.id !== tempId))
    } else if (data) {
      setTodos(prev => prev.map(t => t.id === tempId ? { ...data, status: data.status || firstColId } : t))
    }
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
  }

  const startRename = (col: KanbanCol) => { setEditingColId(col.id); setEditingColLabel(col.label) }
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
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist', sans-serif, fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: view === v ? 'white' : 'transparent', color: view === v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: view === v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
                {v === 'list' ? 'List' : 'Board'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div>
          <div className="fade-up" style={{ display: 'flex', gap: 7, marginBottom: 16 }}>
            {([{k:'all',l:'All'},{k:'today',l:'Today'},{k:'high',l:'High priority'},{k:'done',l:'Done'}] as const).map(f => (
              <button key={f.k} onClick={() => setFilter(f.k as any)} style={{ padding: '6px 16px', borderRadius: 9, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Geist', sans-serif, transition: 'all 0.2s', background: filter === f.k ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.68)', borderColor: filter === f.k ? 'rgba(99,102,241,0.3)' : 'rgba(200,210,240,0.5)', color: filter === f.k ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
                {f.l}
              </button>
            ))}
          </div>

          {/* Inline add */}
          <div style={{ marginBottom: 10 }}>
            {showListInline ? (
              <div className="glass-card fade-up" style={{ padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <input className="glass-input" value={listInlineTitle} onChange={e => setListInlineTitle(e.target.value)} placeholder="Task name…" autoFocus onKeyDown={e => { if (e.key === 'Enter') addListTask(); if (e.key === 'Escape') { setShowListInline(false); setListInlineTitle('') } }} style={{ flex: 1 }} />
                <button className="glass-button-primary" onClick={addListTask} style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>Add</button>
                <button className="glass-button" onClick={() => { setShowListInline(false); setListInlineTitle('') }} style={{ padding: '8px 12px', fontSize: 13 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowListInline(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 12, border: '1.5px dashed rgba(99,102,241,0.22)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13.5, transition: 'all 0.2s', width: '100%', fontFamily: 'Geist', sans-serif }}>
                <span style={{ fontSize: 18, color: 'var(--accent)', lineHeight: 1 }}>+</span> Add a task…
              </button>
            )}
          </div>

          {loading
            ? <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>Loading…</div>
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
                          {t.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(t.due_date + 'T00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>}
                          {t.description && <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.description}</span>}
                        </div>
                      </div>
                      {t.priority && <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: prioColor(t.priority), boxShadow: `0 0 6px ${prioColor(t.priority)}88` }} />}
                      <button onClick={() => del(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, opacity: 0.4, transition: 'opacity 0.15s', fontSize: 16 }}>✕</button>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* BOARD VIEW */}
      {view === 'kanban' && (
        <div>
          <div className="fade-up" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 16 }}>
            {cols.map(col => {
              const colTodos = todos.filter(t => t.status === col.id)
              return (
                <div
                  key={col.id}
                  className={`kanban-col ${dragOver === col.id ? 'drag-over' : ''}`}
                  style={{ minWidth: 268, width: 268, flexShrink: 0 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => { e.preventDefault(); if (dragging) moveStatus(dragging, col.id); setDragOver(null) }}
                >
                  {/* Col header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 3, background: col.color, boxShadow: `0 0 8px ${col.color}99`, flexShrink: 0 }} />
                    {editingColId === col.id ? (
                      <input value={editingColLabel} onChange={e => setEditingColLabel(e.target.value)} onBlur={commitRename} onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingColId(null) }} autoFocus style={{ flex: 1, fontSize: 13, fontWeight: 640, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Geist', sans-serif, color: 'var(--text-primary)', borderBottom: '1.5px solid var(--accent)' }} />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 640, color: 'var(--text-primary)', flex: 1, cursor: 'text' }} onDoubleClick={() => startRename(col)} >{col.label}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.65)', padding: '1px 7px', borderRadius: 6, fontWeight: 500 }}>{colTodos.length}</span>
                    {cols.length > 1 && <button onClick={() => deleteCol(col.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, opacity: 0.35, fontSize: 14, flexShrink: 0 }}>✕</button>}
                  </div>

                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
                    {colTodos.map((t, i) => (
                      <div key={t.id} className="kanban-card" draggable onDragStart={() => setDragging(t.id)} onDragEnd={() => { setDragging(null); setDragOver(null) }} style={{ opacity: dragging === t.id ? 0.4 : 1, animation: `fadeUp 0.3s ease ${i * 35}ms both` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 530, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>{t.title}</span>
                          <button onClick={() => del(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.35, fontSize: 14, flexShrink: 0 }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
                          {t.subject && <span className="subject-tag">{t.subject}</span>}
                          {t.priority && <div style={{ width: 6, height: 6, borderRadius: '50%', background: prioColor(t.priority), boxShadow: `0 0 5px ${prioColor(t.priority)}88`, flexShrink: 0 }} />}
                          {t.due_date && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{new Date(t.due_date + 'T00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inline add */}
                  {inlineColId === col.id ? (
                    <div style={{ marginTop: 10 }}>
                      <input
                        ref={inlineRef}
                        className="glass-input"
                        value={inlineTitle}
                        onChange={e => setInlineTitle(e.target.value)}
                        placeholder="Task name…"
                        onKeyDown={e => { if (e.key === 'Enter') addKanbanTask(col.id); if (e.key === 'Escape') { setInlineColId(null); setInlineTitle('') } }}
                        style={{ fontSize: 13, marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button className="glass-button-primary" onClick={() => addKanbanTask(col.id)} style={{ flex: 1, padding: '7px', fontSize: 12.5 }}>Add</button>
                        <button className="glass-button" onClick={() => { setInlineColId(null); setInlineTitle('') }} style={{ padding: '7px 12px', fontSize: 12.5 }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setInlineColId(col.id); setInlineTitle('') }} style={{ marginTop: 10, width: '100%', padding: '9px', border: '1.5px dashed rgba(99,102,241,0.2)', borderRadius: 11, background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'Geist', sans-serif, transition: 'all 0.18s' }}>
                      + Add task
                    </button>
                  )}
                </div>
              )
            })}

            {/* Add column */}
            {addingCol ? (
              <div className="kanban-col" style={{ minWidth: 234, width: 234, flexShrink: 0 }}>
                <input className="glass-input" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} placeholder="Column name…" autoFocus onKeyDown={e => { if (e.key === 'Enter') addCol(); if (e.key === 'Escape') setAddingCol(false) }} style={{ fontSize: 13, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                  {COL_COLORS.map(c => <div key={c} onClick={() => setNewColColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', outline: newColColor === c ? `2.5px solid ${c}` : 'none', outlineOffset: 2, transform: newColColor === c ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.15s' }} />)}
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button className="glass-button-primary" onClick={addCol} style={{ flex: 1, padding: '7px', fontSize: 12.5 }}>Add</button>
                  <button className="glass-button" onClick={() => { setAddingCol(false); setNewColLabel('') }} style={{ padding: '7px 12px', fontSize: 12.5 }}>✕</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setAddingCol(true)} style={{ minWidth: 52, width: 52, flexShrink: 0, borderRadius: 'var(--radius)', border: '1.5px dashed rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 24, transition: 'all 0.2s', minHeight: 80 }}>+</div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>💡 Drag cards · Double-click column header to rename</p>
        </div>
      )}
    </div>
  )
}
