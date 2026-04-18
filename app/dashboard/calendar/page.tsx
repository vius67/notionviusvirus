'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type Ev = { id: string; title: string; description: string|null; start_time: string; end_time: string|null; color: string|null }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const COLORS = ['#6366f1','#a78bfa','#34d399','#f59e0b','#ef4444','#f87171']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)
const HOUR_HEIGHT = 56

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

// Robustly parse any Supabase timestamp as LOCAL time by stripping all timezone info.
// Handles: "2026-04-18T09:00:00Z", "2026-04-18T09:00:00+00:00", "2026-04-18 09:00:00+00",
//          "2026-04-18T09:00:00.000Z", bare "2026-04-18T09:00"
const parseTS = (s: string): Date => {
  const clean = s
    .replace(' ', 'T')                     // normalise space separator
    .replace(/\.\d+/, '')                  // strip milliseconds
    .replace(/Z$/i, '')                    // strip Z
    .replace(/[+-]\d{2}:?\d{2}$/, '')     // strip +00:00 or +00 or -05:30
  return new Date(clean)
}

const fmtTime = (s: string) =>
  parseTS(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

export default function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Ev[]>([])
  const [cur, setCur] = useState(new Date())
  const [view, setView] = useState<'month'|'week'>('week')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string|null>(null)

  // Side panel form state
  const today = new Date()
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_time: `${localDateStr(today)}T09:00`,
    end_time: `${localDateStr(today)}T10:00`,
    color: '#6366f1',
  })
  const [formError, setFormError] = useState('')

  // Drag state (week view)
  const [dragDay, setDragDay] = useState<Date|null>(null)
  const [dragStartY, setDragStartY] = useState<number|null>(null)
  const [dragEndY, setDragEndY] = useState<number|null>(null)
  const [dragging, setDragging] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    // Use a wide local date range as strings — avoids UTC boundary issues
    const from = new Date(); from.setMonth(from.getMonth() - 3)
    const to = new Date(); to.setMonth(to.getMonth() + 6)
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true })
    if (!error) setEvents(data || [])
  }, [user])

  useEffect(() => { if (user) load() }, [user, load])

  const save = async () => {
    if (!form.title.trim()) { setFormError('Title is required'); return }
    if (!form.start_time) { setFormError('Start time is required'); return }
    setFormError('')
    setSaving(true)
    const { error } = await supabase.from('calendar_events').insert({
      title: form.title.trim(),
      description: form.description || null,
      start_time: form.start_time,
      end_time: form.end_time || null,
      color: form.color,
      user_id: user!.id,
    })
    setSaving(false)
    if (!error) {
      setForm(f => ({ ...f, title: '', description: '' }))
      load()
    }
  }

  const del = async (id: string) => {
    setDeletingId(id)
    await supabase.from('calendar_events').delete().eq('id', id)
    setEvents(ev => ev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  // Pre-fill the form when clicking a time slot / day
  const prefillForm = (startISO: string, endISO: string) => {
    setForm(f => ({ ...f, start_time: startISO, end_time: endISO }))
  }

  const openDay = (d: Date) => {
    const iso = localDateStr(d)
    prefillForm(`${iso}T09:00`, `${iso}T10:00`)
  }

  // Week navigation
  const weekStart = new Date(cur)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })

  const prevWeek = () => { const d = new Date(cur); d.setDate(d.getDate()-7); setCur(d) }
  const nextWeek = () => { const d = new Date(cur); d.setDate(d.getDate()+7); setCur(d) }
  const prevMonth = () => { const d = new Date(cur); d.setMonth(d.getMonth()-1); setCur(d) }
  const nextMonth = () => { const d = new Date(cur); d.setMonth(d.getMonth()+1); setCur(d) }

  // Month grid
  const firstDay = new Date(cur.getFullYear(), cur.getMonth(), 1)
  const lastDay = new Date(cur.getFullYear(), cur.getMonth()+1, 0)
  const cells: (Date|null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) cells.push(new Date(cur.getFullYear(), cur.getMonth(), i))

  const isToday = (d: Date) => localDateStr(d) === localDateStr(today)

  // Get events for a specific day — uses localDateStr comparison for correctness
  const dayEvs = (d: Date) =>
    events.filter(e => localDateStr(parseTS(e.start_time)) === localDateStr(d))

  // Drag to create
  const yToHour = (y: number) => Math.max(HOURS[0], Math.min(HOURS[HOURS.length-1]+1, HOURS[0] + y / HOUR_HEIGHT))
  const hourToISO = (day: Date, hour: number) => {
    const h = Math.floor(hour)
    const m = Math.round((hour - h) * 60 / 15) * 15
    const mm = m >= 60 ? 59 : m
    const hh = m >= 60 ? h+1 : h
    return `${localDateStr(day)}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
  }

  const handleMouseDown = (e: React.MouseEvent, day: Date) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragDay(day); setDragStartY(e.clientY - rect.top); setDragEndY(e.clientY - rect.top); setDragging(true)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragDay) return
    const col = document.querySelector(`[data-day="${localDateStr(dragDay)}"]`) as HTMLElement
    if (!col) return
    const rect = col.getBoundingClientRect()
    setDragEndY(Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT * HOURS.length)))
  }, [dragging, dragDay])

  const handleMouseUp = useCallback(() => {
    if (!dragging || !dragDay || dragStartY === null || dragEndY === null) { setDragging(false); return }
    const startH = yToHour(Math.min(dragStartY, dragEndY))
    const endH = yToHour(Math.max(dragStartY, dragEndY))
    const finalEnd = endH - startH < 0.4 ? startH + 1 : endH
    prefillForm(hourToISO(dragDay, startH), hourToISO(dragDay, finalEnd))
    setDragging(false); setDragDay(null); setDragStartY(null); setDragEndY(null)
  }, [dragging, dragDay, dragStartY, dragEndY])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [handleMouseMove, handleMouseUp])

  const getDragPreview = (day: Date) => {
    if (!dragging || !dragDay || dragStartY === null || dragEndY === null) return null
    if (localDateStr(day) !== localDateStr(dragDay)) return null
    const minY = Math.min(dragStartY, dragEndY); const maxY = Math.max(dragStartY, dragEndY)
    return { top: Math.max(0, minY), height: Math.max(HOUR_HEIGHT * 0.5, maxY - minY) }
  }

  // Upcoming events — compare by date string only so today's events always show
  const todayStr = localDateStr(today)
  const thirtyDaysStr = localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))
  const upcomingEvs = events.filter(e => {
    const ds = localDateStr(parseTS(e.start_time))
    return ds >= todayStr && ds <= thirtyDaysStr
  }).slice(0, 8)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <p className="page-eyebrow">Schedule</p>
            <h1 style={{ fontSize: 26, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              {view === 'week'
                ? `${MONTHS[weekStart.getMonth()].slice(0,3)} ${weekStart.getDate()} – ${MONTHS[weekDays[6].getMonth()].slice(0,3)} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
                : `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="glass-button" onClick={view==='week' ? prevWeek : prevMonth} style={{ padding: '6px 12px', fontSize: 15 }}>‹</button>
            <button className="glass-button" onClick={() => setCur(new Date())} style={{ padding: '6px 13px', fontSize: 12.5 }}>Today</button>
            <button className="glass-button" onClick={view==='week' ? nextWeek : nextMonth} style={{ padding: '6px 12px', fontSize: 15 }}>›</button>
          </div>
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.68)', border: '1px solid rgba(200,210,240,0.5)', borderRadius: 12, padding: 3 }}>
          {(['week','month'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: view===v ? 'white' : 'transparent', color: view===v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: view===v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: Calendar + Side Panel */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Calendar */}
        <div className="fade-up" style={{ flex: 1, minWidth: 0 }}>

          {/* MONTH VIEW */}
          {view === 'month' && (
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                {DAYS.map(d => <div key={d} style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, fontWeight: 660, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {cells.map((day, i) => {
                  const evs = day ? dayEvs(day) : []
                  const tod = day && isToday(day)
                  return (
                    <div key={i} onClick={() => day && openDay(day)} style={{ minHeight: 90, padding: '8px 10px', borderRight: '1px solid rgba(99,102,241,0.05)', borderBottom: '1px solid rgba(99,102,241,0.05)', cursor: day ? 'pointer' : 'default', background: tod ? 'rgba(99,102,241,0.03)' : 'transparent', transition: 'background 0.15s' }}>
                      {day && (
                        <>
                          <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12.5, fontWeight: tod ? 660 : 400, color: tod ? 'white' : 'var(--text-primary)', background: tod ? 'var(--accent)' : 'transparent', boxShadow: tod ? '0 2px 10px rgba(99,102,241,0.4)' : 'none', marginBottom: 3 }}>{day.getDate()}</div>
                          {evs.slice(0,3).map(e => (
                            <div key={e.id} onClick={ev => { ev.stopPropagation(); del(e.id) }} style={{ fontSize: 10.5, fontWeight: 520, padding: '2px 7px', borderRadius: 5, background: (e.color||'#6366f1')+'22', color: e.color||'#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', marginBottom: 2, borderLeft: `2.5px solid ${e.color||'#6366f1'}`, opacity: deletingId===e.id ? 0.4 : 1 }} >{e.title}</div>
                          ))}
                          {evs.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 2 }}>+{evs.length-3}</div>}
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
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)', borderBottom: '1px solid rgba(99,102,241,0.08)', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)', zIndex: 10 }}>
                <div />
                {weekDays.map(d => (
                  <div key={localDateStr(d)} style={{ padding: '10px 0', textAlign: 'center', borderLeft: '1px solid rgba(99,102,241,0.05)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{DAYS[d.getDay()]}</div>
                    <div onClick={() => openDay(d)} style={{ width: 28, height: 28, margin: '3px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 13, fontWeight: isToday(d) ? 660 : 400, color: isToday(d) ? 'white' : 'var(--text-primary)', background: isToday(d) ? 'var(--accent)' : 'transparent', boxShadow: isToday(d) ? '0 2px 10px rgba(99,102,241,0.4)' : 'none', cursor: 'pointer' }}>{d.getDate()}</div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
                {/* Hour labels */}
                <div style={{ borderRight: '1px solid rgba(99,102,241,0.06)' }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 3, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, userSelect: 'none' }}>
                      {h===12 ? '12p' : h<12 ? `${h}a` : `${h-12}p`}
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
                      key={dayISO}
                      data-day={dayISO}
                      style={{ borderLeft: '1px solid rgba(99,102,241,0.05)', position: 'relative', cursor: dragging ? 'ns-resize' : 'crosshair', userSelect: 'none', background: isToday(d) ? 'rgba(99,102,241,0.014)' : 'transparent' }}
                      onMouseDown={e => handleMouseDown(e, d)}
                    >
                      {HOURS.map(h => (
                        <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgba(99,102,241,0.04)', position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: '50%', left: 0, right: 0, borderBottom: '1px dashed rgba(99,102,241,0.035)' }} />
                        </div>
                      ))}

                      {/* Drag preview */}
                      {preview && (
                        <div style={{ position: 'absolute', left: 2, right: 2, top: preview.top, height: preview.height, background: 'rgba(99,102,241,0.13)', border: '1.5px solid rgba(99,102,241,0.35)', borderRadius: 7, pointerEvents: 'none', zIndex: 2, display: 'flex', alignItems: 'flex-start', padding: '3px 7px' }}>
                          <span style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600 }}>New event</span>
                        </div>
                      )}

                      {/* Events */}
                      {evs.map(e => {
                        const s = parseTS(e.start_time)
                        const en = e.end_time ? parseTS(e.end_time) : new Date(s.getTime()+3600000)
                        const startHour = s.getHours() + s.getMinutes()/60
                        const endHour = en.getHours() + en.getMinutes()/60
                        // Only render if within visible hours
                        if (endHour < HOURS[0] || startHour > HOURS[HOURS.length-1]+1) return null
                        const top = Math.max(0, (startHour - HOURS[0]) * HOUR_HEIGHT)
                        const height = Math.max((endHour - startHour) * HOUR_HEIGHT, HOUR_HEIGHT * 0.38)
                        return (
                          <div
                            key={e.id}
                            onClick={ev => { ev.stopPropagation(); del(e.id) }}
                                                        style={{ position: 'absolute', left: 3, right: 3, top, height, background: `${e.color||'#6366f1'}22`, border: `1px solid ${e.color||'#6366f1'}44`, borderLeft: `3px solid ${e.color||'#6366f1'}`, borderRadius: 7, padding: '3px 7px', fontSize: 10.5, fontWeight: 540, color: e.color||'var(--accent-deep)', overflow: 'hidden', cursor: 'pointer', zIndex: 1, transition: 'opacity 0.15s', opacity: deletingId===e.id ? 0.3 : 1, backdropFilter: 'blur(6px)' }}
                          >
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{e.title}</div>
                            {height > 30 && <div style={{ fontSize: 9.5, opacity: 0.7, marginTop: 1 }}>{fmtTime(e.start_time)}{e.end_time ? ` – ${fmtTime(e.end_time)}` : ''}</div>}
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
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 7 }}>
              Drag a time slot to set the time · Click an event to delete it
            </p>
          )}
        </div>

        {/* Side Panel */}
        <div className="fade-up" style={{ width: 290, flexShrink: 0, animationDelay: '80ms', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Create event form */}
          <div className="glass-card" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 660, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>
              Add Event
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label>
                <input
                  className="glass-input"
                  value={form.title}
                  onChange={e => { setForm(f => ({...f, title: e.target.value})); setFormError('') }}
                  placeholder="Event name…"
                  onKeyDown={e => { if (e.key === 'Enter' && form.title) save() }}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</label>
                <input className="glass-input" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({...f, start_time: e.target.value}))} style={{ fontSize: 12.5 }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</label>
                <input className="glass-input" type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({...f, end_time: e.target.value}))} style={{ fontSize: 12.5 }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Colour</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(f => ({...f, color: c}))} style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', outline: form.color===c ? `3px solid ${c}` : 'none', outlineOffset: 2, transition: 'all 0.15s', transform: form.color===c ? 'scale(1.2)' : 'scale(1)', boxShadow: form.color===c ? `0 2px 8px ${c}66` : 'none' }} />
                  ))}
                </div>
              </div>

              {formError && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>}

              <button
                className="glass-button-primary"
                onClick={save}
                disabled={saving || !form.title.trim()}
                style={{ marginTop: 2, width: '100%', padding: '9px 0', fontSize: 13 }}
              >
                {saving ? 'Saving…' : 'Create event'}
              </button>
            </div>
          </div>

          {/* Upcoming events */}
          <div className="glass-card" style={{ padding: '18px 16px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 660, color: 'var(--text-primary)', marginBottom: 12 }}>Upcoming (30 days)</div>
            {upcomingEvs.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No upcoming events</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {upcomingEvs.map(e => {
                  const d = parseTS(e.start_time)
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: 'rgba(255,255,255,0.55)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.8)', transition: 'opacity 0.15s', opacity: deletingId===e.id ? 0.3 : 1 }}>
                      <div style={{ width: 3.5, height: 32, borderRadius: 2, flexShrink: 0, background: e.color||'#6366f1' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })} · {fmtTime(e.start_time)}
                        </div>
                      </div>
                      <button onClick={() => del(e.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '2px 4px', borderRadius: 5, lineHeight: 1, opacity: 0.5, transition: 'opacity 0.15s' }} >✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
