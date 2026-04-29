'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type Ev = { id: string; title: string; description: string|null; start_time: string; end_time: string|null; color: string|null; source?: 'notion'; url?: string }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const COLORS = ['#6366f1','#a78bfa','#34d399','#f59e0b','#ef4444','#f87171','#3b82f6','#ec4899']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)
const HOUR_HEIGHT = 60
const BORDER = 'rgba(99,102,241,0.07)'

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const parseTS = (s: string): Date => {
  let clean = s.replace(' ','T').replace(/\.\d+/,'').replace(/Z$/i,'').replace(/[+-]\d{2}:?\d{2}$/,'')
  if (!clean.includes('T')) clean += 'T00:00'  // Notion date-only → local midnight
  return new Date(clean)
}

const fmtTime = (s: string) =>
  parseTS(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

const fmtHour = (hour: number) => {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60 / 15) * 15
  const mm = m >= 60 ? 0 : m
  const hh = m >= 60 ? h + 1 : h
  const ampm = hh % 24 < 12 ? 'am' : 'pm'
  const h12 = hh % 12 || 12
  return `${h12}:${String(mm).padStart(2,'0')}${ampm}`
}

// An event is "all-day" if:
//  - Notion date-only format (no T, no space → "2026-04-29"), OR
//  - starts at midnight and ends at 23:59 or midnight next day
const isAllDay = (e: Ev) => {
  if (!e.start_time.includes('T') && !e.start_time.includes(' ')) return true
  const s = parseTS(e.start_time)
  if (s.getHours() !== 0 || s.getMinutes() !== 0) return false
  if (!e.end_time) return false
  const en = parseTS(e.end_time)
  return (en.getHours() === 23 && en.getMinutes() >= 58) ||
    (en.getHours() === 0 && en.getMinutes() === 0 && localDateStr(en) !== localDateStr(s))
}

// Notion "N" badge SVG
const NotionBadge = () => (
  <svg width="8" height="8" viewBox="0 0 14 14" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M2 2.5C2 1.67 2.67 1 3.5 1h7C11.33 1 12 1.67 12 2.5v9c0 .83-.67 1.5-1.5 1.5h-7C2.67 13 2 12.33 2 11.5v-9zm2 1v7l5.5-3.5L4 3.5z"/>
  </svg>
)

export default function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents]         = useState<Ev[]>([])
  const [notionEvs, setNotionEvs]   = useState<Ev[]>([])
  const [notionOk, setNotionOk]     = useState<boolean|null>(null) // null=loading, false=not configured
  const [cur, setCur]               = useState(new Date())
  const [view, setView]             = useState<'month'|'week'>('week')
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [nowY, setNowY]             = useState(0)
  const [allDay, setAllDay]         = useState(false)

  const today = new Date()
  const [form, setForm] = useState({
    title: '', description: '',
    start_time: `${localDateStr(today)}T09:00`,
    end_time:   `${localDateStr(today)}T10:00`,
    color: '#6366f1',
  })
  const [formError, setFormError] = useState('')

  // Drag state
  const [dragDay,    setDragDay]    = useState<Date|null>(null)
  const [dragStartY, setDragStartY] = useState<number|null>(null)
  const [dragEndY,   setDragEndY]   = useState<number|null>(null)
  const [dragging,   setDragging]   = useState(false)

  // Current-time indicator
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setNowY((now.getHours() + now.getMinutes() / 60 - HOURS[0]) * HOUR_HEIGHT)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('calendar_events').select('*').eq('user_id', user.id)
      .order('start_time', { ascending: true })
    if (!error) setEvents(data || [])
  }, [user])

  useEffect(() => { if (user) load() }, [user, load])

  // Notion events — fetched once on mount, auto-refreshes every 5 min
  useEffect(() => {
    const fetchNotion = async () => {
      try {
        const res  = await fetch('/api/notion/events')
        const json = await res.json() as { events: Ev[]; configured: boolean }
        setNotionOk(json.configured)
        setNotionEvs(json.events || [])
      } catch { setNotionOk(false) }
    }
    fetchNotion()
    const id = setInterval(fetchNotion, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const save = async () => {
    if (!form.title.trim()) { setFormError('Title is required'); return }
    setFormError(''); setSaving(true)
    const start = allDay ? `${form.start_time.slice(0,10)}T00:00` : form.start_time
    const end   = allDay ? `${form.start_time.slice(0,10)}T23:59` : form.end_time || null
    const { error } = await supabase.from('calendar_events').insert({
      title: form.title.trim(), description: form.description || null,
      start_time: start, end_time: end, color: form.color, user_id: user!.id,
    })
    setSaving(false)
    if (!error) { setForm(f => ({ ...f, title: '', description: '' })); load() }
  }

  const del = async (id: string) => {
    setDeletingId(id)
    await supabase.from('calendar_events').delete().eq('id', id)
    setEvents(ev => ev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  const prefillForm = (startISO: string, endISO: string) => {
    setForm(f => ({ ...f, start_time: startISO, end_time: endISO })); setAllDay(false)
  }
  const openDay = (d: Date) => { const iso = localDateStr(d); prefillForm(`${iso}T09:00`, `${iso}T10:00`) }

  // Week helpers
  const weekStart = new Date(cur)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  })
  const prevWeek  = () => { const d = new Date(cur); d.setDate(d.getDate()-7); setCur(d) }
  const nextWeek  = () => { const d = new Date(cur); d.setDate(d.getDate()+7); setCur(d) }
  const prevMonth = () => { const d = new Date(cur); d.setMonth(d.getMonth()-1); setCur(d) }
  const nextMonth = () => { const d = new Date(cur); d.setMonth(d.getMonth()+1); setCur(d) }

  // Month grid
  const firstDay = new Date(cur.getFullYear(), cur.getMonth(), 1)
  const lastDay  = new Date(cur.getFullYear(), cur.getMonth()+1, 0)
  const cells: (Date|null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) cells.push(new Date(cur.getFullYear(), cur.getMonth(), i))

  const isToday   = (d: Date) => localDateStr(d) === localDateStr(today)
  const allEvents = [...events, ...notionEvs]
  const dayEvs    = (d: Date) => allEvents.filter(e => localDateStr(parseTS(e.start_time)) === localDateStr(d))

  // Drag to create
  const yToHour = (y: number) => Math.max(HOURS[0], Math.min(HOURS[HOURS.length-1]+1, HOURS[0] + y / HOUR_HEIGHT))
  const hourToISO = (day: Date, hour: number) => {
    const h = Math.floor(hour); const m = Math.round((hour-h)*60/15)*15
    const mm = m>=60 ? 0 : m; const hh = m>=60 ? h+1 : h
    return `${localDateStr(day)}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
  }

  const handleMouseDown = (e: React.MouseEvent, day: Date) => {
    if (e.button !== 0) return; e.preventDefault()
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
    const endH   = yToHour(Math.max(dragStartY, dragEndY))
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
    const startH = yToHour(minY)
    const endH   = yToHour(Math.max(maxY, minY + HOUR_HEIGHT * 0.5))
    return { top: Math.max(0,minY), height: Math.max(HOUR_HEIGHT*0.5, maxY-minY), startH, endH }
  }

  // Upcoming — from all sources
  const todayStr      = localDateStr(today)
  const thirtyDaysStr = localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate()+30))
  const upcomingEvs   = allEvents
    .filter(e => { const ds = localDateStr(parseTS(e.start_time)); return ds >= todayStr && ds <= thirtyDaysStr })
    .sort((a,b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 10)

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
        <div style={{ display: 'flex', background: 'var(--chip-bg, rgba(255,255,255,0.68))', border: '1px solid rgba(200,210,240,0.5)', borderRadius: 12, padding: 3 }}>
          {(['week','month'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '6px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: view===v ? 'white' : 'transparent', color: view===v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: view===v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Calendar */}
        <div className="fade-up" style={{ flex: 1, minWidth: 0 }}>

          {/* MONTH VIEW */}
          {view === 'month' && (
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1px solid ${BORDER}` }}>
                {DAYS.map(d => <div key={d} style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, fontWeight: 660, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {cells.map((day, i) => {
                  const evs = day ? dayEvs(day) : []
                  const tod = day && isToday(day)
                  return (
                    <div key={i} onClick={() => day && openDay(day)}
                      style={{ minHeight: 90, padding: '8px 10px', borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, cursor: day ? 'pointer' : 'default', background: tod ? 'rgba(99,102,241,0.03)' : 'transparent', transition: 'background 0.15s' }}>
                      {day && (
                        <>
                          <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12.5, fontWeight: tod ? 660 : 400, color: tod ? 'white' : 'var(--text-primary)', background: tod ? 'var(--accent)' : 'transparent', boxShadow: tod ? '0 2px 10px rgba(99,102,241,0.4)' : 'none', marginBottom: 3 }}>{day.getDate()}</div>
                          {evs.slice(0,3).map(e => (
                            <div key={e.id} onClick={ev => { ev.stopPropagation(); del(e.id) }}
                              style={{ fontSize: 10.5, fontWeight: 520, padding: '2px 7px', borderRadius: 5, background: (e.color||'#6366f1')+'22', color: e.color||'#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', marginBottom: 2, borderLeft: `2.5px solid ${e.color||'#6366f1'}`, opacity: deletingId===e.id ? 0.4 : 1 }}>{e.title}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)', borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, background: 'color-mix(in srgb, var(--bg-base, #fff) 94%, transparent)', backdropFilter: 'blur(20px)', zIndex: 10 }}>
                <div />
                {weekDays.map(d => (
                  <div key={localDateStr(d)} style={{ padding: '10px 0', textAlign: 'center', borderLeft: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{DAYS[d.getDay()]}</div>
                    <div onClick={() => openDay(d)} style={{ width: 28, height: 28, margin: '3px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 13, fontWeight: isToday(d) ? 660 : 400, color: isToday(d) ? 'white' : 'var(--text-primary)', background: isToday(d) ? 'var(--accent)' : 'transparent', boxShadow: isToday(d) ? '0 2px 10px rgba(99,102,241,0.4)' : 'none', cursor: 'pointer' }}>{d.getDate()}</div>
                  </div>
                ))}
              </div>

              {/* All-day events row — only shown when there are all-day events this week */}
              {(() => {
                const adByDay = weekDays.map(d => dayEvs(d).filter(isAllDay))
                if (!adByDay.some(a => a.length > 0)) return null
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)', borderBottom: `1px solid ${BORDER}`, background: 'rgba(99,102,241,0.018)' }}>
                    <div style={{ padding: '7px 7px 7px 0', textAlign: 'right', fontSize: 9, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.3, paddingTop: 9, userSelect: 'none' }}>
                      all<br/>day
                    </div>
                    {weekDays.map((d, i) => (
                      <div key={localDateStr(d)} style={{ borderLeft: `1px solid ${BORDER}`, padding: '4px 3px', minHeight: 30, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {adByDay[i].map(e => (
                          <div key={e.id}
                            onClick={() => e.source==='notion' ? window.open(e.url,'_blank') : del(e.id)}
                            style={{ fontSize: 10.5, fontWeight: 580, padding: '2px 8px', borderRadius: 4, background: e.color || '#6366f1', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', opacity: deletingId===e.id ? 0.3 : 1, transition: 'opacity 0.15s', boxShadow: `0 1px 4px ${e.color||'#6366f1'}44`, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {e.source==='notion' && <NotionBadge />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })()}

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
                  const timedEvs = dayEvs(d).filter(e => !isAllDay(e))
                  const preview  = getDragPreview(d)
                  const dayISO   = localDateStr(d)
                  const todayCol = isToday(d)
                  return (
                    <div
                      key={dayISO}
                      data-day={dayISO}
                      style={{ borderLeft: '1px solid rgba(99,102,241,0.05)', position: 'relative', cursor: dragging ? 'ns-resize' : 'crosshair', userSelect: 'none', background: todayCol ? 'rgba(99,102,241,0.014)' : 'transparent' }}
                      onMouseDown={e => handleMouseDown(e, d)}
                    >
                      {/* Hour lines */}
                      {HOURS.map(h => (
                        <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgba(99,102,241,0.04)', position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: '50%', left: 0, right: 0, borderBottom: '1px dashed rgba(99,102,241,0.03)' }} />
                        </div>
                      ))}

                      {/* Now line */}
                      {todayCol && nowY > 0 && nowY < HOUR_HEIGHT * HOURS.length && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: nowY, zIndex: 3, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', left: -1, top: -3.5, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                          <div style={{ height: 2, background: '#ef4444', opacity: 0.85 }} />
                        </div>
                      )}

                      {/* Drag preview — colored with selected color, shows time range */}
                      {preview && (
                        <div style={{ position: 'absolute', left: 2, right: 2, top: preview.top, height: preview.height, background: `${form.color}28`, border: `2px solid ${form.color}99`, borderRadius: 8, pointerEvents: 'none', zIndex: 2, padding: '4px 7px', boxSizing: 'border-box', boxShadow: `0 2px 12px ${form.color}22` }}>
                          <div style={{ fontSize: 11, color: form.color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.title || 'New event'}</div>
                          {preview.height > 24 && (
                            <div style={{ fontSize: 9.5, color: form.color, opacity: 0.8 }}>{fmtHour(preview.startH)} – {fmtHour(preview.endH)}</div>
                          )}
                        </div>
                      )}

                      {/* Timed events */}
                      {timedEvs.map(e => {
                        const s  = parseTS(e.start_time)
                        const en = e.end_time ? parseTS(e.end_time) : new Date(s.getTime()+3600000)
                        const startHour = s.getHours() + s.getMinutes()/60
                        const endHour   = en.getHours() + en.getMinutes()/60
                        if (endHour < HOURS[0] || startHour > HOURS[HOURS.length-1]+1) return null
                        const top    = Math.max(0, (startHour - HOURS[0]) * HOUR_HEIGHT)
                        const height = Math.max((endHour - startHour) * HOUR_HEIGHT, HOUR_HEIGHT * 0.38)
                        return (
                          <div key={e.id}
                            onClick={ev => { ev.stopPropagation(); e.source==='notion' ? window.open(e.url,'_blank') : del(e.id) }}
                            style={{ position: 'absolute', left: 3, right: 3, top, height, background: `${e.color||'#6366f1'}22`, border: `1px solid ${e.color||'#6366f1'}44`, borderLeft: `3px solid ${e.color||'#6366f1'}`, borderRadius: 7, padding: '3px 7px', fontSize: 10.5, fontWeight: 540, color: e.color||'var(--accent-deep)', overflow: 'hidden', cursor: 'pointer', zIndex: 1, transition: 'opacity 0.15s', opacity: deletingId===e.id ? 0.3 : 1, backdropFilter: 'blur(6px)' }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                              {e.source==='notion' && <NotionBadge />}{e.title}
                            </div>
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
              Drag to create · Click event to delete
            </p>
          )}
        </div>

        {/* Side Panel */}
        <div className="fade-up" style={{ width: 290, flexShrink: 0, animationDelay: '80ms', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Notion connection status */}
          {notionOk !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 12, background: notionOk ? 'rgba(0,0,0,0.04)' : 'rgba(239,68,68,0.06)', border: `1px solid ${notionOk ? 'rgba(0,0,0,0.10)' : 'rgba(239,68,68,0.18)'}` }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill={notionOk ? 'var(--text-primary)' : '#ef4444'}><path d="M1.5 1.5h11v11h-11z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M4 4l6 6M4 10V4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              <span style={{ fontSize: 11.5, color: notionOk ? 'var(--text-secondary)' : '#ef4444', fontWeight: 520 }}>
                {notionOk ? `Notion synced · ${notionEvs.length} event${notionEvs.length!==1?'s':''}` : 'Notion not configured — add NOTION_TOKEN + NOTION_CALENDAR_DB_ID to .env'}
              </span>
            </div>
          )}

          {/* Create event form */}
          <div className="glass-card" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 660, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>
              Add Event
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label>
                <input className="glass-input" value={form.title}
                  onChange={e => { setForm(f => ({...f, title: e.target.value})); setFormError('') }}
                  placeholder="Event name…"
                  onKeyDown={e => { if (e.key==='Enter' && form.title) save() }}
                  style={{ fontSize: 13 }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
                <input className="glass-input" value={form.description}
                  onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  placeholder="Optional note…" style={{ fontSize: 13 }} />
              </div>

              {/* All-day toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div onClick={() => setAllDay(a => !a)}
                  style={{ width: 34, height: 19, borderRadius: 10, background: allDay ? 'var(--accent)' : 'rgba(128,128,128,0.22)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2.5, left: allDay ? 17 : 2.5, width: 14, height: 14, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.18s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }} onClick={() => setAllDay(a => !a)}>All day</span>
              </div>

              {allDay ? (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</label>
                  <input className="glass-input" type="date" value={form.start_time.slice(0,10)}
                    onChange={e => setForm(f => ({...f, start_time: `${e.target.value}T00:00`, end_time: `${e.target.value}T23:59`}))}
                    style={{ fontSize: 12.5 }} />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</label>
                    <input className="glass-input" type="datetime-local" value={form.start_time}
                      onChange={e => setForm(f => ({...f, start_time: e.target.value}))} style={{ fontSize: 12.5 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</label>
                    <input className="glass-input" type="datetime-local" value={form.end_time}
                      onChange={e => setForm(f => ({...f, end_time: e.target.value}))} style={{ fontSize: 12.5 }} />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 580, color: 'var(--text-muted)', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Colour</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(f => ({...f, color: c}))}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', outline: form.color===c ? `3px solid ${c}` : 'none', outlineOffset: 2, transition: 'all 0.15s', transform: form.color===c ? 'scale(1.2)' : 'scale(1)', boxShadow: form.color===c ? `0 2px 8px ${c}66` : 'none' }} />
                  ))}
                </div>
              </div>

              {formError && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>}

              <button className="glass-button-primary" onClick={save} disabled={saving || !form.title.trim()}
                style={{ marginTop: 2, width: '100%', padding: '9px 0', fontSize: 13 }}>
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
                  const d  = parseTS(e.start_time)
                  const ad = isAllDay(e)
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: e.source==='notion' ? 'rgba(0,0,0,0.03)' : 'rgba(128,128,128,0.06)', borderRadius: 10, border: e.source==='notion' ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(128,128,128,0.12)', transition: 'opacity 0.15s', opacity: deletingId===e.id ? 0.3 : 1 }}>
                      <div style={{ width: 3.5, height: 32, borderRadius: 2, flexShrink: 0, background: e.color||'#6366f1' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {e.source==='notion' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,0,0,0.08)', color: 'var(--text-muted)', letterSpacing: '0.04em', flexShrink: 0 }}>N</span>}
                          {e.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })} · {ad ? 'All day' : fmtTime(e.start_time)}
                        </div>
                      </div>
                      {e.source==='notion'
                        ? <a href={e.url} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '2px 5px', borderRadius: 5, textDecoration: 'none', opacity: 0.55 }}>↗</a>
                        : <button onClick={() => del(e.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '2px 4px', borderRadius: 5, lineHeight: 1, opacity: 0.5 }}>✕</button>
                      }
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
