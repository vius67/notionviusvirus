'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import Modal from '@/components/Modal'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'

type Paper = { id: string; subject: string; year: number|null; score: number|null; max_score: number|null; notes: string|null; completed_at: string|null; created_at: string }
const SUBJECTS = ['Mathematics','English','Science','Physics','Chemistry','Biology','History','Geography','German','Enterprise Computing','PDHPE','Other']

export default function PastPapersPage() {
  const { user } = useAuth()
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [sel, setSel] = useState('all')
  const [form, setForm] = useState({ subject: '', year: new Date().getFullYear().toString(), score: '', max_score: '100', notes: '', completed_at: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    const { data } = await supabase.from('past_papers').select('*').eq('user_id', user.id).order('completed_at', { ascending: false })
    setPapers(data || []); setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const save = async () => {
    if (!user || !form.subject) return
    setSaving(true)
    await supabase.from('past_papers').insert({ subject: form.subject, year: form.year ? parseInt(form.year) : null, score: form.score ? parseFloat(form.score) : null, max_score: form.max_score ? parseFloat(form.max_score) : null, notes: form.notes, completed_at: form.completed_at, user_id: user.id })
    setForm({ subject: '', year: new Date().getFullYear().toString(), score: '', max_score: '100', notes: '', completed_at: new Date().toISOString().split('T')[0] })
    setShowModal(false); setSaving(false); load()
  }

  const del = async (id: string) => {
    await supabase.from('past_papers').delete().eq('id', id)
    setPapers(papers.filter(p => p.id !== id))
  }

  const subjects = ['all', ...Array.from(new Set(papers.map(p => p.subject)))]
  const filtered = sel === 'all' ? papers : papers.filter(p => p.subject === sel)
  const getPct = (p: Paper) => p.score != null && p.max_score ? Math.round((p.score / p.max_score) * 100) : null
  const pctColor = (pct: number|null) => pct == null ? 'var(--text-muted)' : pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'

  const barData = SUBJECTS.filter(s => papers.some(p => p.subject === s)).map(s => {
    const sp = papers.filter(p => p.subject === s && p.score != null && p.max_score)
    const avg = sp.length ? Math.round(sp.reduce((a, p) => a + (p.score! / p.max_score!) * 100, 0) / sp.length) : 0
    return { subject: s.slice(0, 5), avg, count: sp.length }
  }).filter(d => d.count > 0)

  const lineData = (sel === 'all' ? papers : filtered)
    .filter(p => p.score != null && p.max_score && p.completed_at)
    .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
    .map(p => ({ date: new Date(p.completed_at!).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }), pct: getPct(p) }))

  const CustomTooltip = ({ active, payload, label }: any) => active && payload?.length ? (
    <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(80,100,200,0.1)' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontWeight: 600, color: 'var(--accent)' }}>{payload[0].value}%</p>
    </div>
  ) : null

  return (
    <div>
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Progress</p>
          <h1 style={{ fontSize: 26, fontWeight: 650, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Past Papers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{papers.length} papers logged</p>
        </div>
        <button className="glass-button-primary fade-up" onClick={() => setShowModal(true)} style={{ marginTop: 6 }}>+ Log paper</button>
      </div>

      {papers.length > 0 && (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
          <div className="glass-card fade-up" style={{ padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Avg score by subject</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.07)" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" fill="#6366f1" radius={[6,6,0,0]} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card fade-up" style={{ padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Score trend</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={lineData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.07)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="fade-up" style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        {subjects.map(s => (
          <button key={s} onClick={() => setSel(s)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, fontFamily: 'Geist, sans-serif', transition: 'all 0.18s', background: sel === s ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.6)', borderColor: sel === s ? 'rgba(99,102,241,0.3)' : 'rgba(200,210,240,0.5)', color: sel === s ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
            {s === 'all' ? 'All subjects' : s}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div> :
        filtered.length === 0
          ? <div className="glass-card" style={{ padding: 44, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No papers logged yet</div>
          : <div className="glass-card fade-up" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'rgba(99,102,241,0.04)' }}>
                    {['Subject','Year','Score','%','Date','Notes',''].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(99,102,241,0.07)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const pct = getPct(p)
                    return (
                      <tr key={p.id} className="fade-up" style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(99,102,241,0.05)' : 'none', animationDelay: `${i*35}ms` }}>
                        <td style={{ padding: '11px 16px' }}><span className="subject-tag">{p.subject}</span></td>
                        <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{p.year || '—'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'Geist Mono, monospace', fontSize: 13 }}>{p.score != null ? `${p.score}/${p.max_score}` : '—'}</td>
                        <td style={{ padding: '11px 16px', minWidth: 100 }}>
                          {pct != null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 48, height: 4, background: 'rgba(99,102,241,0.1)', borderRadius: 2 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pctColor(pct), borderRadius: 2, transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: 12.5, fontWeight: 650, color: pctColor(pct), fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{p.completed_at ? new Date(p.completed_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--text-muted)', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <button onClick={() => del(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, opacity: 0.5 }}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
      }

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Log Past Paper">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Subject *</label>
            <select className="glass-input" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
              <option value="">Select subject…</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Year</label>
              <input className="glass-input" type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} placeholder="2024" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Score</label>
              <input className="glass-input" type="number" value={form.score} onChange={e => setForm({...form, score: e.target.value})} placeholder="85" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Out of</label>
              <input className="glass-input" type="number" value={form.max_score} onChange={e => setForm({...form, max_score: e.target.value})} placeholder="100" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Date completed</label>
            <input className="glass-input" type="date" value={form.completed_at} onChange={e => setForm({...form, completed_at: e.target.value})} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea className="glass-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Areas to revise…" rows={2} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="glass-button" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="glass-button-primary" onClick={save} disabled={saving || !form.subject}>{saving ? 'Saving…' : 'Log paper'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
