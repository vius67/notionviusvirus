'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type Note = { id: string; title: string; content: string; subject: string | null; created_at: string; updated_at: string }
const SUBJECTS = ['Mathematics','English','Science','Physics','Chemistry','Biology','History','Geography','German','Enterprise Computing','PDHPE','Personal','Other']

export default function NotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSubject, setEditSubject] = useState('')

  // Refs for current editor state — avoids stale closure issues
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const titleRef = useRef('')
  const contentRef = useRef('')
  const subjectRef = useRef('')
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  useEffect(() => { if (user) load() }, [user])

  const load = async () => {
    if (!user) return
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    if (!error) setNotes(data || [])
    setLoading(false)
  }

  // Flush any pending save immediately (called before switching notes)
  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const id = selectedIdRef.current
    if (!id) return
    const title = titleRef.current
    const content = contentRef.current
    const subject = subjectRef.current
    const now = new Date().toISOString()
    await supabase.from('notes')
      .update({ title: title || 'Untitled', content, subject: subject || null, updated_at: now })
      .eq('id', id)
    setNotes(prev => prev.map(n => n.id === id
      ? { ...n, title: title || 'Untitled', content, subject: subject || null, updated_at: now }
      : n
    ))
  }, [])

  const scheduleSave = useCallback((id: string, title: string, content: string, subject: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      const now = new Date().toISOString()
      const { error } = await supabase.from('notes')
        .update({ title: title || 'Untitled', content, subject: subject || null, updated_at: now })
        .eq('id', id)
      if (!error) {
        setNotes(prev => prev.map(n => n.id === id
          ? { ...n, title: title || 'Untitled', content, subject: subject || null, updated_at: now }
          : n
        ))
      }
      setSaving(false)
    }, 700)
  }, [])

  const openNote = useCallback(async (note: Note) => {
    // Flush current note's pending changes before switching
    await flushSave()
    setSelectedId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content || '')
    setEditSubject(note.subject || '')
    titleRef.current = note.title
    contentRef.current = note.content || ''
    subjectRef.current = note.subject || ''
  }, [flushSave])

  const createNote = async () => {
    if (!user) return
    await flushSave()
    const { data, error } = await supabase.from('notes')
      .insert({ title: 'Untitled', content: '', user_id: user.id })
      .select().single()
    if (!error && data) {
      setNotes(prev => [data, ...prev])
      openNote(data)
    }
  }

  const handleTitleChange = (v: string) => {
    setEditTitle(v)
    titleRef.current = v
    const id = selectedIdRef.current
    if (id) scheduleSave(id, v, contentRef.current, subjectRef.current)
  }

  const handleContentChange = (v: string) => {
    setEditContent(v)
    contentRef.current = v
    const id = selectedIdRef.current
    if (id) scheduleSave(id, titleRef.current, v, subjectRef.current)
  }

  const handleSubjectChange = (v: string) => {
    setEditSubject(v)
    subjectRef.current = v
    const id = selectedIdRef.current
    if (id) scheduleSave(id, titleRef.current, contentRef.current, v)
  }

  const deleteNote = async (id: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
      setEditTitle(''); setEditContent(''); setEditSubject('')
      titleRef.current = ''; contentRef.current = ''; subjectRef.current = ''
    }
  }

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedNote = notes.find(n => n.id === selectedId) || null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="fade-up" style={{ marginBottom: 20 }}>
        <p className="page-eyebrow">Workspace</p>
        <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Notes</h1>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '260px 1fr',
        height: 'calc(100vh - 170px)',
        borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: '0 8px 40px rgba(80,100,200,0.1)',
      }}>
        {/* Sidebar */}
        <div style={{ background: 'rgba(248,249,255,0.88)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRight: '1px solid rgba(99,102,241,0.07)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(99,102,241,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 660, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Notes ({notes.length})</span>
              <button onClick={createNote} style={{ width: 28, height: 28, border: 'none', background: 'rgba(99,102,241,0.12)', borderRadius: 8, cursor: 'pointer', color: 'var(--accent-deep)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300, transition: 'all 0.18s', boxShadow: '0 1px 4px rgba(99,102,241,0.15)' }}>+</button>
            </div>
            <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…" style={{ fontSize: 13, padding: '8px 11px' }} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {loading
              ? <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
              : filtered.length === 0
                ? <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{search ? 'No results' : 'No notes yet'}</div>
                : filtered.map((n, i) => (
                  <div key={n.id} onClick={() => openNote(n)} style={{
                    padding: '10px 12px', borderRadius: 12, cursor: 'pointer', marginBottom: 3,
                    background: selectedId === n.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                    border: `1px solid ${selectedId === n.id ? 'rgba(99,102,241,0.18)' : 'transparent'}`,
                    transition: 'all 0.15s',
                    animation: `fadeUp 0.3s ease ${i * 28}ms both`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 540, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      {n.subject && <span className="subject-tag" style={{ fontSize: 10 }}>{n.subject}</span>}
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{new Date(n.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {n.content && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{n.content.slice(0, 60)}</div>}
                  </div>
                ))
            }
          </div>

          <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(99,102,241,0.07)' }}>
            <button onClick={createNote} className="glass-button" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
              + New note
            </button>
          </div>
        </div>

        {/* Editor */}
        {selectedNote ? (
          <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(99,102,241,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <select
                className="glass-input"
                value={editSubject}
                onChange={e => handleSubjectChange(e.target.value)}
                style={{ width: 168, padding: '6px 11px', fontSize: 12.5 }}
              >
                <option value="">No subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 11.5, color: saving ? 'var(--accent-mid)' : '#94a3b8', transition: 'color 0.3s', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {saving ? (
                    <><div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-mid)', animation: 'pulse-dot 1s ease infinite' }} /> Saving…</>
                  ) : '✓ Saved'}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {new Date(selectedNote.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => deleteNote(selectedNote.id)}
                  style={{ border: 'none', background: 'rgba(239,68,68,0.07)', color: '#ef4444', cursor: 'pointer', borderRadius: 9, padding: '5px 12px', fontSize: 12.5, fontFamily: 'Geist, sans-serif', fontWeight: 500, transition: 'all 0.15s' }}
                >Delete</button>
              </div>
            </div>

            {/* Title */}
            <input
              value={editTitle}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Untitled"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 26, fontWeight: 680, color: 'var(--text-primary)', fontFamily: 'Geist, sans-serif', padding: '28px 32px 10px', letterSpacing: '-0.03em', flexShrink: 0 }}
            />

            {/* Content */}
            <textarea
              value={editContent}
              onChange={e => handleContentChange(e.target.value)}
              placeholder="Start writing… your thoughts, summaries, ideas."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, color: 'var(--text-secondary)', fontFamily: 'Geist, sans-serif', padding: '6px 32px 32px', resize: 'none', lineHeight: 1.8 }}
            />
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(40px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'float 3s ease infinite' }}>
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="var(--accent-mid)" strokeWidth="1.4" strokeLinecap="round"><path d="M5 3h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M7 7h6M7 10h6M7 13h4"/></svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 540 }}>Select a note</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>or create a new one to start writing</p>
            </div>
            <button className="glass-button-primary" onClick={createNote}>+ New note</button>
          </div>
        )}
      </div>
    </div>
  )
}
