'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import Modal from '@/components/Modal'

type Ev = { id: string; title: string; description: string|null; start_time: string; end_time: string|null; color: string|null }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const COLORS = ['#6366f1','#a78bfa','#34d399','#f59e0b','#ef4444','#f87171']

// Hours visible in week view (7am - 9pm)
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)
const HOUR_HEIGHT = 56 // px per hour

// Always use LOCAL date to avoid UTC shift (critical for AU timezones UTC+10/11)
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Parse a timestamp from Supabase robustly (handles Z suffix, +offset, or bare local)
const parseTS = (s: string): Date => {
  // If it has no timezone marker, treat as local time by appending nothing
  // If it has Z or offset, Date will handle it correctly
  return new Date(s)
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Ev[]>([])
  const [cur, setCur] = useState(new Date())
  const [view, setView] = useState<'month'|'week'>('week')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '', color: '#6366f1' })
  const [saving, setSaving] = useState(false)

  // Drag-to-create state
  const [dragDay, setDragDay] = useState<Date|null>(null)
  const [dragStartY, setDragStartY] = useState<number|null>(null)
  const [dragEndY, setDragEndY] = useState<number|null>(null)
  const [dragging, setDragging] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!user) return
    // Fetch a reasonable window: 3 months back to 6 months forward
    const from = new Date(); from.setMonth(from.getMonth() - 3)
    const to = new Date(); to.setMonth(to.getMonth() + 6)
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', from.toISOString())
      .lte('start_time', to.toISOString())
      .order('start_time', { ascending: true })
    setEvents(data || [])
  }
  useEffect(() => { if (user) load() }, [user])

  const save = async () => {
    if (!user || !form.title || !form.start_time) return
    setSaving(true)
    await supabase.from('calendar_events').insert({ ...form, user_id: user.id })
    setForm({ title: '', description: '', start_time: '', end_time: '', color: '#6366f1' })
    setShowModal(false); setSaving(false); load()
  }

  const del = async (id: string) => {
    await supabase.from('calendar_events').delete().eq('id', id)
    setEvents(events.filter(e => e.id !== id))
  }

  const openModal = (startISO: string, endISO: string) => {
    setForm(f => ({ ...f, start_time: startISO, end_time: endISO }))
    setShowModal(true)
  }

  const openDay = (d: Date) => {
    const iso = localDateStr(d)
    openModal(`${iso}T09:00`, `${iso}T10:00`)
  }

  // Convert Y offset within the time grid to a fractional hour
  const yToHour = (y: number): number => {
    const hour = HOURS[0] + y / HOUR_HEIGHT
    return Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1] + 1, hour))
  }

  const hourToISO = (day: Date, hour: number): string => {
    const h = Math.floor(hour)
    const m = Math.round((hour - h) * 60 / 15) * 15
    const mm = m >= 60 ? 59 : m
    const hh = m >= 60 ? h + 1 : h
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${localDateStr(day)}T${pad(hh)}:${pad(mm)}`
  }

  const handleMouseDown = (e: React.MouseEvent, day: Date) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    setDragDay(day)
    setDragStartY(y)
    setDragEndY(y)
    setDragging(true)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || dragDay === null) return
    const col = document.querySelector(`[data-day="${localDateStr(dragDay)}"]`) as HTMLElement
    if (!col) return
    const rect = col.getBoundingClientRect()
    const y = Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT * HOURS.length))
    setDragEndY(y)
  }, [dragging, dragDay])

  const handleMouseUp = useCallback(() => {
    if (!dragging || dragDay === null || dragStartY === null || dragEndY === null) {
      setDragging(false); return
    }
    const startHour = yToHour(Math.min(dragStartY, dragEndY))
    const endHour = yToHour(Math.max(dragStartY, dragEndY))
    const duration = endHour - startHour
    const finalEnd = duration < 0.4 ? startHour + 1 : endHour

    openModal(hourToISO(dragDay, startHour), hourToISO(dragDay, finalEnd))
    setDragging(false); setDragDay(null); setDragStartY(null); setDragEndY(null)
  }, [dragging, dragDay, dragStartY, dragEndY])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Month helpers
  const firstDay = new Date(cur.getFullYear(), cur.getMonth(), 1)
  const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
  const cells: (Date|null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) cells.push(new Date(cur.getFullYear(), cur.getMonth(), i))

  const today = new Date()
  const isToday = (d: Date) => localDateStr(d) === localDateStr(today)
  const dayEvs = (d: Date) => events.filter(e => localDateStr(parseTS(e.start_time)) === localDateStr(d))

  // Week helpers
  const weekStart = new Date(cur)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })

  const prevWeek = () => { const d = new Date(cur); d.setDate(d.getDate() - 7); setCur(d) }
  const nextWeek = () => { const d = new Date(cur); d.setDate(d.getDate() + 7); setCur(d) }
  const prevMonth = () => { const d = new Date(cur); d.setMonth(d.getMonth()-1); setCur(d) }
  const nextMonth = () => { const d = new Date(cur); d.setMonth(d.getMonth()+1); setCur(d) }

  // Drag preview in week view
  const getDragPreview = (day: Date) => {
    if (!dragging || !dragDay || dragStartY === null || dragEndY === null) return null
    if (localDateStr(day) !== localDateStr(dragDay)) return null
    const minY = Math.min(dragStartY, dragEndY)
    const maxY = Math.max(dragStartY, dragEndY)
    const top = Math.max(0, minY)
    const height = Math.max(HOUR_HEIGHT * 0.5, maxY - minY)
    return { top, height }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <p className="page-eyebrow">Schedule</p>
            <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              {view === 'week'
                ? `${MONTHS[weekStart.getMonth()].slice(0,3)} ${weekStart.getDate()} – ${MONTHS[weekDays[6].getMonth()].slice(0,3)} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
                : `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="glass-button" onClick={view === 'week' ? prevWeek : prevMonth} style={{ padding: '7px 13px', fontSize: 15 }}>‹</button>
            <button className="glass-button" onClick={() => setCur(new Date())} style={{ padding: '7px 14px', fontSize: 12.5 }}>Today</button>
            <button className="glass-button" onClick={view === 'week' ? nextWeek : nextMonth} style={{ padding: '7px 13px', fontSize: 15 }}>›</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.68)', border: '1px solid rgba(200,210,240,0.5)', borderRadius: 12, padding: 3 }}>
            {(['week','month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: view === v ? 'white' : 'transparent', color: view === v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: view === v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
                {v.charAt(0).toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>
          <button className="glass-button-primary" onClick={() => { const iso = localDateStr(today); openModal(`${iso}T09:00`, `${iso}T10:00`) }}>+ Add event</button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div className="glass-card fade-up" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
            {DAYS.map(d => <div key={d} style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, fontWeight: 660, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {cells.map((day, i) => {
              const evs = day ? dayEvs(day) : []
              const tod = day && isToday(day)
              return (
                <div key={i} onClick={() => day && openDay(day)} style={{ minHeight: 100, padding: '8px 10px', borderRight: '1px solid rgba(99,102,241,0.05)', borderBottom: '1px solid rgba(99,102,241,0.05)', cursor: day ? 'pointer' : 'default', background: tod ? 'rgba(99,102,241,0.03)' : 'transparent', transition: 'background 0.15s' }}>
                  {day && (
                    <>
                      <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12.5, fontWeight: tod ? 660 : 400, color: tod ? 'white' : 'var(--text-primary)', background: tod ? 'var(--accent)' : 'transparent', boxShadow: tod ? '0 2px 10px rgba(99,102,241,0.4)' : 'none', marginBottom: 4 }}>{day.getDate()}</div>
                      {evs.slice(0,3).map(e => (
                        <div key={e.id} onClick={ev => { ev.stopPropagation(); del(e.id) }} style={{ fontSize: 10.5, fontWeight: 520, padding: '2px 7px', borderRadius: 5, background: (e.color||'#6366f1')+'22', color: e.color||'#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', marginBottom: 2, borderLeft: `2.5px solid ${e.color||'#6366f1'}` }} title="Click to delete">{e.title}</div>
                      ))}
                      {evs.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>+{evs.length-3} more</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="glass-card fade-up" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7,1fr)', borderBottom: '1px solid rgba(99,102,241,0.08)', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', zIndex: 10 }}>
            <div />
            {weekDays.map(d => (
              <div key={d.toISOString()} style={{ padding: '12px 0', textAlign: 'center', borderLeft: '1px solid rgba(99,102,241,0.05)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{DAYS[d.getDay()]}</div>
                <div onClick={() => openDay(d)} style={{ width: 28, height: 28, margin: '4px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 13.5, fontWeight: isToday(d) ? 660 : 400, color: isToday(d) ? 'white' : 'var(--text-primary)', background: isToday(d) ? 'var(--accent)' : 'transparent', boxShadow: isToday(d) ? '0 2px 10px rgba(99,102,241,0.4)' : 'none', cursor: 'pointer', transition: 'all 0.15s' }}>{d.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '52px repeat(7,1fr)', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {/* Hour labels */}
            <div style={{ borderRight: '1px solid rgba(99,102,241,0.06)' }}>
              {HOURS.map(h => (
                <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 10, paddingTop: 3, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(d => {
              const evs = dayEvs(d)
              const preview = getDragPreview(d)
              const dayISO = localDateStr(d)
              return (
                <div
                  key={d.toISOString()}
                  data-day={dayISO}
                  style={{ borderLeft: '1px solid rgba(99,102,241,0.05)', position: 'relative', cursor: dragging ? 'ns-resize' : 'crosshair', userSelect: 'none' }}
                  onMouseDown={e => handleMouseDown(e, d)}
                >
                  {/* Hour grid lines */}
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgba(99,102,241,0.04)', borderTop: h === HOURS[0] ? 'none' : undefined, position: 'relative' }}>
                      {/* Half-hour mark */}
                      <div style={{ position: 'absolute', bottom: '50%', left: 0, right: 0, borderBottom: '1px dashed rgba(99,102,241,0.04)' }} />
                    </div>
                  ))}

                  {/* Drag preview */}
                  {preview && (
                    <div style={{
                      position: 'absolute', left: 2, right: 2,
                      top: preview.top, height: preview.height,
                      background: 'rgba(99,102,241,0.15)',
                      border: '1.5px solid rgba(99,102,241,0.4)',
                      borderRadius: 8,
                      pointerEvents: 'none', zIndex: 2,
                      display: 'flex', alignItems: 'flex-start', padding: '4px 8px',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>New event</span>
                    </div>
                  )}

                  {/* Events */}
                  {evs.map(e => {
                    const s = parseTS(e.start_time)
                    const en = e.end_time ? parseTS(e.end_time) : new Date(s.getTime() + 3600000)
                    const startHour = s.getHours() + s.getMinutes() / 60
                    const endHour = en.getHours() + en.getMinutes() / 60
                    const top = (startHour - HOURS[0]) * HOUR_HEIGHT
                    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, HOUR_HEIGHT * 0.4)
                    return (
                      <div
                        key={e.id}
                        onClick={ev => { ev.stopPropagation(); del(e.id) }}
                        title={`${e.title} — click to delete`}
                        style={{
                          position: 'absolute', left: 3, right: 3, top,
                          height, background: `${(e.color||'#6366f1')}28`,
                          border: `1px solid ${(e.color||'#6366f1')}55`,
                          borderLeft: `3px solid ${e.color||'#6366f1'}`,
                          borderRadius: 8, padding: '4px 8px',
                          fontSize: 11, fontWeight: 540,
                          color: e.color || 'var(--accent-deep)',
                          overflow: 'hidden', cursor: 'pointer', zIndex: 1,
                          transition: 'opacity 0.15s',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                        {height > 28 && (
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>
                            {parseTS(e.start_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            {e.end_time && ` – ${parseTS(e.end_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          💡 Click and drag on any time slot to create an event · Click an event to delete it
        </p>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Event">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Title *</label>
            <input className="glass-input" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Event name" autoFocus onKeyDown={e => { if (e.key === 'Enter' && form.title && form.start_time) save() }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Start *</label>
              <input className="glass-input" type="datetime-local" value={form.start_time} onChange={e => setForm({...form,start_time:e.target.value})} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>End</label>
              <input className="glass-input" type="datetime-local" value={form.end_time} onChange={e => setForm({...form,end_time:e.target.value})} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
            <input className="glass-input" value={form.description||''} onChange={e => setForm({...form,description:e.target.value})} placeholder="Optional" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 560, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Colour</label>
            <div style={{ display: 'flex', gap: 9 }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm({...form,color:c})} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', outline: form.color===c ? `3px solid ${c}` : 'none', outlineOffset: 2.5, transition: 'all 0.15s', transform: form.color===c ? 'scale(1.18)' : 'scale(1)', boxShadow: form.color===c ? `0 3px 10px ${c}66` : 'none' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="glass-button" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="glass-button-primary" onClick={save} disabled={saving||!form.title||!form.start_time}>{saving?'Saving…':'Add event'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
