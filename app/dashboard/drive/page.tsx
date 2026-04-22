'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type DriveItem = { name: string; id: string; updated_at: string; created_at: string; metadata?: { size?: number; mimetype?: string }; isFolder?: boolean }
type SortKey = 'name' | 'size' | 'modified'

const BUCKET = 'drive'

function FileIcon({ mime, name, size = 18 }: { mime?: string; name?: string; size?: number }) {
  const m = mime || ''; const n = (name || '').toLowerCase(); const s = size
  if (m.startsWith('image/'))       return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
  if (m === 'application/pdf' || n.endsWith('.pdf')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h1.5a1.5 1.5 0 010 3H9v-6h1.5a1.5 1.5 0 010 3"/></svg>
  if (m.includes('spreadsheet') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h8M8 9h4"/></svg>
  if (m.startsWith('video/'))       return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10 8 16 12 10 16 10 8" fill="#f59e0b"/></svg>
  if (m.startsWith('audio/'))       return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  if (m.includes('zip') || n.endsWith('.zip')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}

function FolderIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#f59e0b33" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}

const formatSize = (b?: number) => !b ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

export default function DrivePage() {
  const { user } = useAuth()
  const [items, setItems] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string|null>(null)
  const [renamingId, setRenamingId] = useState<string|null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [currentFolder, setCurrentFolder] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const newFolderRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) load() }, [user, currentFolder])
  useEffect(() => { if (showNewFolder) setTimeout(() => newFolderRef.current?.focus(), 50) }, [showNewFolder])

  const load = async () => {
    if (!user) return
    setLoading(true); setError(null)
    const prefix = currentFolder ? `/${currentFolder}` : ''
    const { data, error: err } = await supabase.storage.from(BUCKET).list(`${user.id}${prefix}`, {
      limit: 300, sortBy: { column: 'updated_at', order: 'desc' },
    })
    if (err) {
      setError(err.message.includes('not found') || err.message.includes('does not exist')
        ? 'Drive bucket not set up. Create a bucket named "drive" in Supabase Storage.'
        : err.message)
      setLoading(false); return
    }
    const all = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder')
    setItems([...all.filter(f => !f.id).map(f => ({ ...f, isFolder: true })), ...all.filter(f => f.id).map(f => ({ ...f, isFolder: false }))])
    setLoading(false)
  }

  const upload = async (files: File[]) => {
    if (!files.length || !user) return
    setUploading(true); setError(null)
    for (const file of files) {
      setUploadProgress(file.name)
      const folder = currentFolder ? `${currentFolder}/` : ''
      const { error: err } = await supabase.storage.from(BUCKET).upload(`${user.id}/${folder}${Date.now()}_${file.name}`, file, { upsert: true })
      if (err) { setError(`Failed: ${err.message}`); break }
    }
    setUploading(false); setUploadProgress(null)
    if (inputRef.current) inputRef.current.value = ''
    load()
  }

  const download = async (item: DriveItem) => {
    if (!user || item.isFolder) return
    const folder = currentFolder ? `${currentFolder}/` : ''
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${user.id}/${folder}${item.name}`, 60)
    if (!data) return
    Object.assign(document.createElement('a'), { href: data.signedUrl, download: getPublicName(item.name) }).click()
  }

  const deleteItem = async (item: DriveItem) => {
    if (!user) return
    setDeleting(item.name)
    const folder = currentFolder ? `${currentFolder}/` : ''
    if (item.isFolder) {
      const { data } = await supabase.storage.from(BUCKET).list(`${user.id}/${item.name}`)
      if (data?.length) await supabase.storage.from(BUCKET).remove(data.map(f => `${user.id}/${item.name}/${f.name}`))
    } else {
      await supabase.storage.from(BUCKET).remove([`${user.id}/${folder}${item.name}`])
    }
    setDeleting(null); load()
  }

  const commitRename = async (item: DriveItem) => {
    if (!user || !renameVal.trim()) { setRenamingId(null); return }
    const folder = currentFolder ? `${currentFolder}/` : ''
    const oldPath = `${user.id}/${folder}${item.name}`
    const newPath = `${user.id}/${folder}${Date.now()}_${renameVal.trim()}`
    const { data } = await supabase.storage.from(BUCKET).download(oldPath)
    if (data) { await supabase.storage.from(BUCKET).upload(newPath, data); await supabase.storage.from(BUCKET).remove([oldPath]) }
    setRenamingId(null); load()
  }

  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return
    const folder = currentFolder ? `${currentFolder}/` : ''
    await supabase.storage.from(BUCKET).upload(`${user.id}/${folder}${newFolderName.trim()}/.emptyFolderPlaceholder`, new Blob(['']))
    setNewFolderName(''); setShowNewFolder(false); load()
  }

  const openFolder = (name: string) => setCurrentFolder(currentFolder ? `${currentFolder}/${name}` : name)
  const getPublicName = (name: string) => name.replace(/^\d+_/, '')
  const breadcrumbs = currentFolder ? currentFolder.split('/') : []

  const sorted = [...items.filter(f => getPublicName(f.name).toLowerCase().includes(search.toLowerCase()))].sort((a, b) => {
    // Folders always first
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    let cmp = 0
    if (sortKey === 'name') cmp = getPublicName(a.name).localeCompare(getPublicName(b.name))
    else if (sortKey === 'size') cmp = (a.metadata?.size ?? 0) - (b.metadata?.size ?? 0)
    else cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    return sortAsc ? cmp : -cmp
  })

  const handleSort = (k: SortKey) => { if (sortKey === k) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(true) } }
  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? null : (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ marginLeft: 4 }}>
      {sortAsc ? <path d="M5 2l4 6H1z"/> : <path d="M5 8L1 2h8z"/>}
    </svg>
  )

  const ColHeader = ({ label, k, width }: { label: string; k: SortKey; width?: number }) => (
    <div onClick={() => handleSort(k)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600, color: sortKey === k ? 'var(--accent-deep)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', userSelect: 'none', width, flexShrink: 0, transition: 'color 0.15s' }}>
      {label}<SortIcon k={k} />
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p className="page-eyebrow">Storage</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Drive</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ paddingLeft: 32, width: 200, fontSize: 13 }} />
          </div>
          <button className="glass-button" onClick={() => setShowNewFolder(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            New folder
          </button>
          <button className="glass-button-primary" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="16" x2="12" y2="4"/><polyline points="8 8 12 4 16 8"/><path d="M20 21H4"/></svg>
            {uploading ? (uploadProgress ? `${uploadProgress.slice(0,18)}…` : 'Uploading…') : 'Upload'}
          </button>
          <input ref={inputRef} type="file" multiple onChange={e => upload(Array.from(e.target.files || []))} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14, fontSize: 13.5 }}>
        <button onClick={() => setCurrentFolder('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Geist', sans-serif, fontSize: 13.5, fontWeight: 600, color: currentFolder ? 'var(--accent)' : 'var(--text-primary)', padding: '3px 6px', borderRadius: 6, transition: 'background 0.15s' }}>
          My Drive
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <button onClick={() => setCurrentFolder(breadcrumbs.slice(0, i+1).join('/'))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Geist', sans-serif, fontSize: 13.5, fontWeight: 600, color: i === breadcrumbs.length-1 ? 'var(--text-primary)' : 'var(--accent)', padding: '3px 6px', borderRadius: 6, transition: 'background 0.15s' }}>
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* New folder inline input */}
      {showNewFolder && (
        <div className="fade-in" style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <FolderIcon size={16} />
          </div>
          <input
            ref={newFolderRef}
            className="glass-input"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') } }}
            style={{ width: 220, fontSize: 13 }}
          />
          <button className="glass-button-primary" onClick={createFolder} style={{ fontSize: 13, padding: '8px 16px' }}>Create</button>
          <button className="glass-button" onClick={() => { setShowNewFolder(false); setNewFolderName('') }} style={{ fontSize: 13, padding: '8px 12px' }}>Cancel</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Main table */}
      <div
        className="glass-card fade-up"
        style={{ padding: 0, overflow: 'hidden', border: dragOver ? '1.5px solid rgba(99,102,241,0.35)' : undefined, transition: 'border 0.15s' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); upload(Array.from(e.dataTransfer.files)) }}
      >
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px', gap: 0, padding: '10px 18px', borderBottom: '1px solid rgba(99,102,241,0.07)', background: 'rgba(248,250,255,0.6)' }}>
          <ColHeader label="Name" k="name" />
          <ColHeader label="Size" k="size" width={100} />
          <ColHeader label="Modified" k="modified" width={140} />
          <div style={{ width: 100 }} />
        </div>

        {loading ? (
          <div style={{ padding: '12px 0' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px', padding: '11px 18px', gap: 0 }}>
                <div className="skeleton" style={{ height: 16, width: '55%', animationDelay: `${i*60}ms` }} />
                <div className="skeleton" style={{ height: 16, width: 50, animationDelay: `${i*60+20}ms` }} />
                <div className="skeleton" style={{ height: 16, width: 90, animationDelay: `${i*60+40}ms` }} />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>{search ? 'No results' : currentFolder ? 'Empty folder' : 'No files yet'}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 4 }}>Drop files here or click Upload</p>
          </div>
        ) : (
          sorted.map((item, i) => {
            const pubName = getPublicName(item.name)
            const hovered = hoveredRow === item.name
            return (
              <div
                key={item.name}
                style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 100px', padding: '10px 18px', borderBottom: i < sorted.length-1 ? '1px solid rgba(99,102,241,0.05)' : 'none', background: hovered ? 'rgba(99,102,241,0.035)' : 'transparent', transition: 'background 0.12s', cursor: item.isFolder ? 'pointer' : 'default', animation: `fadeUp 0.28s ease ${i*20}ms both`, alignItems: 'center' }}
                onMouseEnter={() => setHoveredRow(item.name)}
                onMouseLeave={() => setHoveredRow(null)}
                onDoubleClick={() => item.isFolder ? openFolder(item.name) : (setRenamingId(item.name), setRenameVal(pubName))}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingRight: 16 }}>
                  {item.isFolder ? <FolderIcon size={18} /> : <FileIcon mime={item.metadata?.mimetype} name={pubName} size={18} />}
                  {renamingId === item.name ? (
                    <input
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => commitRename(item)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(item); if (e.key === 'Escape') setRenamingId(null) }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      style={{ border: 'none', borderBottom: '1.5px solid var(--accent)', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'Geist', sans-serif, color: 'var(--text-primary)', width: '100%' }}
                    />
                  ) : (
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pubName}</span>
                  )}
                </div>

                {/* Size */}
                <div style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {item.isFolder ? '—' : formatSize(item.metadata?.size)}
                </div>

                {/* Modified */}
                <div style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatDate(item.updated_at)}
                </div>

                {/* Actions — visible on hover */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                  {item.isFolder ? (
                    <button onClick={e => { e.stopPropagation(); openFolder(item.name) }} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.07)', color: 'var(--accent-deep)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist', sans-serif, fontWeight: 500 }}>Open</button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); download(item) }} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.07)', color: 'var(--accent-deep)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist', sans-serif, fontWeight: 500 }}>Download</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteItem(item) }} disabled={deleting === item.name} style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {deleting === item.name
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite' }}><circle cx="12" cy="12" r="9"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    }
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Drop overlay hint */}
        {dragOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', borderRadius: 'inherit' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>Drop to upload</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {items.filter(f => !f.isFolder).length} file{items.filter(f => !f.isFolder).length !== 1 ? 's' : ''} · {items.filter(f => f.isFolder).length} folder{items.filter(f => f.isFolder).length !== 1 ? 's' : ''}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Double-click to rename · Drag files to upload</p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
