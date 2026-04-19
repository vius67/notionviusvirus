'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type HW = {
  id: string; title: string; subject: string | null
  due_date: string | null; notes: string | null
  completed: boolean; created_at: string
}
type Paper = {
  id: string; subject: string; year: number | null
  score: number | null; max_score: number | null
  notes: string | null; completed_at: string | null
}

const SUBJECTS = [
  'Mathematics','English','Physics','Chemistry',
  'Biology','Science','History','Geography','German',
  'Enterprise Computing','PDHPE','Other',
]

const SUBJECT_COLOR: Record<string, string> = {
  'Mathematics':           '#6366f1',
  'English':               '#ec4899',
  'Physics':               '#f59e0b',
  'Chemistry':             '#10b981',
  'Biology':               '#22c55e',
  'Science':               '#14b8a6',
  'History':               '#a855f7',
  'Geography':             '#3b82f6',
  'German':                '#f97316',
  'Enterprise Computing':  '#06b6d4',
  'PDHPE':                 '#84cc16',
  'Other':                 '#94a3b8',
}

const subjectColor = (s: string | null) => SUBJECT_COLOR[s ?? ''] ?? '#94a3b8'

const getPct = (score: number | null, max: number | null) =>
  score != null && max && max > 0 ? Math.round((score / max) * 100) : null

const pctColor = (p: number | null) =>
  p == null ? 'var(--text-muted)' : p >= 80 ? '#22c55e' : p >= 60 ? '#f59e0b' : '#ef4444'

const getDueInfo = (due: string | null) => {
  if (!due) return null
  const diff = Math.ceil((new Date(due + 'T00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  if (diff === 0) return { label: 'Today',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' }
  return { label: `${diff}d`, color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.08)' }
}

const TODAY = new Date().toISOString().split('T')[0]

export default function HomeworkPage() {
  const { user } = useAuth()
  const [hw, setHw] = useState<HW[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)

  const [showHwForm, setShowHwForm] = useState(false)
  const [hwForm, setHwForm] = useState({ title: '', subject: 'Mathematics', due_date: '', notes: '' })
  const [savingHw, setSavingHw] = useState(false)
  const [deletingHw, setDeletingHw] = useState<string | null>(null)

  const [showPForm, setShowPForm] = useState(false)
  const [pForm, setPForm] = useState({ subject: 'Mathematics', year: String(new Date().getFullYear()), score: '', max_score: '100', notes: '', completed_at: TODAY })
  const [savingP, setSavingP] = useState(false)
  const [deletingP, setDeletingP] = useState<string | null>(null)

  const [subjFilter, setSubjFilter] = useState('all')
  const [hwFilter, setHwFilter] = useState<'pending' | 'all' | 'done'>('pending')

  const load = async () => {
    if (!user) return
    const [h, p] = await Promise.all([
      supabase.from('homework').select('*').eq('user_id', user.id).order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('past_papers').select('*').eq('user_id', user.id).order('completed_at', { ascending: false }),
    ])
    setHw(h.data || [])
    setPapers(p.data || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const addHw = async () => {
    if (!hwForm.title.trim() || !user) return
    setSavingHw(true)
    const { data } = await supabase.from('homework').insert({
      user_id: user.id, title: hwForm.title.trim(), subject: hwForm.subject,
      due_date: hwForm.due_date || null, notes: hwForm.notes || null, completed: false,
    }).select().single()
    if (data) setHw(prev => [data, ...prev].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }))
    setHwForm({ title: '', subject: 'Mathematics', due_date: '', notes: '' })
    setSavingHw(false); setShowHwForm(false)
  }

  const toggleHw = async (id: string, current: boolean) => {
    setHw(prev => prev.map(h => h.id === id ? { ...h, completed: !current } : h))
    await supabase.from('homework').update({ completed: !current }).eq('id', id)
  }

  const deleteHw = async (id: string) => {
    setDeletingHw(id)
    await supabase.from('homework').delete().eq('id', id)
    setHw(prev => prev.filter(h => h.id !== id))
    setDeletingHw(null)
  }

  const addPaper = async () => {
    if (!pForm.score || !pForm.max_score || !user) return
    setSavingP(true)
    const { data } = await supabase.from('past_papers').insert({
      user_id: user.id, subject: pForm.subject,
      year: pForm.year ? parseInt(pForm.year) : null,
      score: parseFloat(pForm.score), max_score: parseFloat(pForm.max_score),
      notes: pForm.notes || null, completed_at: pForm.completed_at || TODAY,
    }).select().single()
    if (data) setPapers(prev => [data, ...prev])
    setPForm({ subject: 'Mathematics', year: String(new Date().getFullYear()), score: '', max_score: '100', notes: '', completed_at: TODAY })
    setSavingP(false); setShowPForm(false)
  }

  const deletePaper = async (id: string) => {
    setDeletingP(id)
    await supabase.from('past_papers').delete().eq('id', id)
    setPapers(prev => prev.filter(x => x.id !== id))
    setDeletingP(null)
  }

  const hwPending = hw.filter(h => !h.completed).length
  const hwDone    = hw.filter(h => h.completed).length
  const scored    = papers.filter(p => p.score != null && p.max_score && p.max_score > 0)
  const avgScore  = scored.length ? Math.round(scored.reduce((a, p) => a + (p.score! / p.max_score!) * 100, 0) / scored.length) : null
  const bestScore = scored.length ? Math.round(Math.max(...scored.map(p => (p.score! / p.max_score!) * 100))) : null

  const allSubjects = Array.from(new Set([
    ...hw.map(h => h.subject).filter(Boolean),
    ...papers.map(p => p.subject),
  ])) as string[]

  const filteredHw = hw
    .filter(h => subjFilter === 'all' || h.subject === subjFilter)
    .filter(h => hwFilter === 'all' ? true : hwFilter === 'pending' ? !h.completed : h.completed)

  const filteredPapers = papers.filter(p => subjFilter === 'all' || p.subject === subjFilter)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 24, height: 24, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <p className="page-eyebrow">Tracker</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 780, letterSpacing: '-0.045em', color: 'var(--text-primary)', lineHeight: 1.1 }}>Homework</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
              {hwPending} pending · {hwDone} done · {papers.length} papers logged
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="Pending"  value={hwPending}          color="#f59e0b" />
            <Chip label="Done"     value={hwDone}             color="#22c55e" />
            <Chip label="Papers"   value={papers.length}      color="#6366f1" />
            {avgScore  != null && <Chip label="Avg"  value={`${avgScore}%`}  color={pctColor(avgScore)}  />}
            {bestScore != null && <Chip label="Best" value={`${bestScore}%`} color="#22c55e" />}
          </div>
        </div>
      </div>

      {/* ── Subject filter pills ── */}
      {allSubjects.length > 0 && (
        <div className="fade-up" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 24, animationDelay: '40ms' }}>
          {['all', ...allSubjects].map(s => (
            <button key={s} onClick={() => setSubjFilter(s)} style={{
              padding: '5px 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 12.5, fontWeight: 540, fontFamily: 'Geist, sans-serif',
              background: subjFilter === s ? (s === 'all' ? '#6366f1' : subjectColor(s)) : 'rgba(255,255,255,0.7)',
              color: subjFilter === s ? 'white' : 'var(--text-secondary)',
              border: subjFilter === s ? 'none' : '1px solid rgba(200,210,240,0.5)',
              boxShadow: subjFilter === s ? `0 2px 10px ${s === 'all' ? 'rgba(99,102,241,0.3)' : subjectColor(s) + '44'}` : '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'all 0.18s ease',
            }}>
              {s === 'all' ? 'All subjects' : s}
            </button>
          ))}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ════ HOMEWORK ════ */}
        <div className="glass-card fade-up" style={{ padding: 0, overflow: 'hidden', animationDelay: '60ms' }}>
          <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h9a2 2 0 012 2v11a2 2 0 01-2 2H4a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M15 14h1a1 1 0 000-2h-1"/><path d="M7 7h5M7 10h5M7 13h3"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 660, color: 'var(--text-primary)' }}>Assignments</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hwPending} pending · {hwDone} done</div>
              </div>
            </div>
            <button onClick={() => { setShowHwForm(s => !s); setShowPForm(false) }} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: showHwForm ? '#6366f1' : 'rgba(99,102,241,0.1)', color: showHwForm ? 'white' : '#6366f1', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s', fontWeight: 300 }}>
              {showHwForm ? '×' : '+'}
            </button>
          </div>

          <div style={{ padding: '12px 20px 0', display: 'flex', gap: 4 }}>
            {(['pending','all','done'] as const).map(f => (
              <button key={f} onClick={() => setHwFilter(f)} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: hwFilter === f ? 600 : 450, fontFamily: 'Geist, sans-serif', background: hwFilter === f ? 'rgba(99,102,241,0.1)' : 'transparent', color: hwFilter === f ? '#6366f1' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {showHwForm && (
            <div style={{ margin: '12px 20px 0', padding: '14px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="glass-input" placeholder="Assignment title *" value={hwForm.title} onChange={e => setHwForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHw()} style={{ padding: '9px 12px', fontSize: 13.5 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="glass-input" value={hwForm.subject} onChange={e => setHwForm(f => ({ ...f, subject: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <input className="glass-input" type="date" value={hwForm.due_date} onChange={e => setHwForm(f => ({ ...f, due_date: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
              </div>
              <input className="glass-input" placeholder="Notes (optional)" value={hwForm.notes} onChange={e => setHwForm(f => ({ ...f, notes: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
              <button className="glass-button-primary" onClick={addHw} disabled={savingHw || !hwForm.title.trim()} style={{ padding: '9px', fontSize: 13, borderRadius: 10 }}>
                {savingHw ? 'Adding…' : 'Add assignment'}
              </button>
            </div>
          )}

          <div style={{ padding: '12px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 520, overflowY: 'auto' }}>
            {filteredHw.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                {hwFilter === 'done' ? 'No completed assignments yet' : 'No pending assignments 🎉'}
              </div>
            ) : filteredHw.map(item => {
              const due = getDueInfo(item.due_date)
              const color = subjectColor(item.subject)
              return (
                <div key={item.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 10px', borderRadius: 12, background: item.completed ? 'transparent' : 'rgba(255,255,255,0.6)', border: '1px solid', borderColor: item.completed ? 'transparent' : 'rgba(255,255,255,0.9)', transition: 'all 0.18s', opacity: deletingHw === item.id ? 0.4 : 1 }}
                  onMouseEnter={e => { if (!item.completed) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.85)' }}
                  onMouseLeave={e => { if (!item.completed) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.6)' }}
                >
                  <button onClick={() => toggleHw(item.id, item.completed)} style={{ marginTop: 1, width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${item.completed ? color : 'rgba(99,102,241,0.3)'}`, background: item.completed ? color : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s', boxShadow: item.completed ? `0 2px 8px ${color}44` : 'none' }}>
                    {item.completed && <svg width="9" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 520, color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.completed ? 'line-through' : 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 560, padding: '2px 7px', borderRadius: 5, background: color + '18', color }}>{item.subject}</span>
                      {due && <span style={{ fontSize: 10.5, fontWeight: 560, padding: '2px 7px', borderRadius: 5, background: due.bg, color: due.color }}>{due.label}</span>}
                      {item.notes && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{item.notes}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteHw(item.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    onFocus={e => (e.currentTarget.style.opacity = '1')} onBlur={e => (e.currentTarget.style.opacity = '0')}
                  >×</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ════ PAST PAPERS ════ */}
        <div className="glass-card fade-up" style={{ padding: 0, overflow: 'hidden', animationDelay: '100ms' }}>
          <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #f59e0b, #fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V9l4-4 4 4 4-6"/><path d="M3 17h14"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 660, color: 'var(--text-primary)' }}>Past Papers</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{papers.length} attempts{avgScore != null ? ` · ${avgScore}% avg` : ''}</div>
              </div>
            </div>
            <button onClick={() => { setShowPForm(s => !s); setShowHwForm(false) }} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: showPForm ? '#f59e0b' : 'rgba(245,158,11,0.1)', color: showPForm ? 'white' : '#f59e0b', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s', fontWeight: 300 }}>
              {showPForm ? '×' : '+'}
            </button>
          </div>

          {showPForm && (
            <div style={{ margin: '12px 20px 0', padding: '14px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.14)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="glass-input" value={pForm.subject} onChange={e => setPForm(f => ({ ...f, subject: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <input className="glass-input" placeholder="Year (e.g. 2024)" value={pForm.year} onChange={e => setPForm(f => ({ ...f, year: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="glass-input" type="number" placeholder="Score *" value={pForm.score} onChange={e => setPForm(f => ({ ...f, score: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
                <input className="glass-input" type="number" placeholder="Out of *" value={pForm.max_score} onChange={e => setPForm(f => ({ ...f, max_score: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
              </div>
              {pForm.score && pForm.max_score && Number(pForm.max_score) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (Number(pForm.score) / Number(pForm.max_score)) * 100)}%`, background: pctColor(getPct(Number(pForm.score), Number(pForm.max_score))), borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 660, color: pctColor(getPct(Number(pForm.score), Number(pForm.max_score))), minWidth: 36 }}>
                    {getPct(Number(pForm.score), Number(pForm.max_score))}%
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="glass-input" type="date" value={pForm.completed_at} onChange={e => setPForm(f => ({ ...f, completed_at: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
                <input className="glass-input" placeholder="Notes (optional)" value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} style={{ padding: '9px 12px', fontSize: 13 }} />
              </div>
              <button className="glass-button-primary" onClick={addPaper} disabled={savingP || !pForm.score || !pForm.max_score} style={{ padding: '9px', fontSize: 13, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #fb923c)', boxShadow: '0 4px 14px rgba(245,158,11,0.32)' }}>
                {savingP ? 'Saving…' : 'Log paper'}
              </button>
            </div>
          )}

          <div style={{ padding: '12px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 520, overflowY: 'auto' }}>
            {filteredPapers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                No past papers logged yet
              </div>
            ) : filteredPapers.map(paper => {
              const pct = getPct(paper.score, paper.max_score)
              const color = subjectColor(paper.subject)
              return (
                <div key={paper.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)', transition: 'all 0.18s', opacity: deletingP === paper.id ? 0.4 : 1 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.85)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.6)'}
                >
                  <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: `2.5px solid ${pct != null ? pctColor(pct) : 'rgba(148,163,184,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: pct != null ? pctColor(pct) + '12' : 'rgba(148,163,184,0.06)' }}>
                    {pct != null
                      ? <span style={{ fontSize: 11, fontWeight: 720, color: pctColor(pct) }}>{pct}%</span>
                      : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 560, padding: '2px 7px', borderRadius: 5, background: color + '18', color }}>{paper.subject}</span>
                      {paper.year && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>{paper.year}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {paper.score != null && paper.max_score && (
                        <>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{paper.score}<span style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text-muted)' }}>/{paper.max_score}</span></span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.07)', overflow: 'hidden', maxWidth: 80 }}>
                            <div style={{ height: '100%', width: `${Math.min(100, pct ?? 0)}%`, background: pctColor(pct), borderRadius: 2 }} />
                          </div>
                        </>
                      )}
                      {paper.notes && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{paper.notes}</span>}
                    </div>
                    {paper.completed_at && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(paper.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deletePaper(paper.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    onFocus={e => (e.currentTarget.style.opacity = '1')} onBlur={e => (e.currentTarget.style.opacity = '0')}
                  >×</button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Subject breakdown ── */}
      {allSubjects.length > 0 && (
        <div className="glass-card fade-up" style={{ marginTop: 20, padding: '20px 24px', animationDelay: '140ms' }}>
          <p style={{ fontSize: 12, fontWeight: 640, color: 'var(--accent-mid)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Subject Breakdown</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {allSubjects.map(subj => {
              const subjHw     = hw.filter(h => h.subject === subj)
              const subjPapers = papers.filter(p => p.subject === subj)
              const subjScored = subjPapers.filter(p => p.score != null && p.max_score && p.max_score > 0)
              const subjAvg    = subjScored.length ? Math.round(subjScored.reduce((a, p) => a + (p.score! / p.max_score!) * 100, 0) / subjScored.length) : null
              const color      = subjectColor(subj)
              return (
                <button key={subj} onClick={() => setSubjFilter(subjFilter === subj ? 'all' : subj)} style={{ textAlign: 'left', padding: '14px', borderRadius: 14, border: `1.5px solid ${subjFilter === subj ? color : 'rgba(200,210,240,0.4)'}`, background: subjFilter === subj ? color + '10' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'Geist, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{subj}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {subjHw.length > 0 && (
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{subjHw.filter(h => !h.completed).length}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>/{subjHw.length}</span></div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>hw</div>
                      </div>
                    )}
                    {subjPapers.length > 0 && (
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: subjAvg != null ? pctColor(subjAvg) : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{subjAvg != null ? `${subjAvg}%` : subjPapers.length}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{subjAvg != null ? 'avg' : 'papers'}</div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: color + '12', border: `1px solid ${color}28` }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 720, color, letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  )
}
