'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type DriveItem = { name: string; id: string; updated_at: string; created_at: string; metadata?: { size?: number; mimetype?: string }; isFolder?: boolean }

const BUCKET = 'drive'

// ── SVG Icons ──────────────────────────────────────────────────
function FileIcon({ mime, name, size = 28 }: { mime?: string; name?: string; size?: number }) {
  const m = mime || ''
  const n = (name || '').toLowerCase()
  const s = size
  if (m.startsWith('image/')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
  if (m === 'application/pdf' || n.endsWith('.pdf')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h1.5a1.5 1.5 0 010 3H9v-6h1.5a1.5 1.5 0 010 3"/></svg>
  if (m.includes('spreadsheet') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h8M8 9h4"/></svg>
  if (m.startsWith('video/')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10 8 16 12 10 16 10 8" fill="#f59e0b"/></svg>
  if (m.startsWith('audio/')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  if (m.includes('zip') || m.includes('archive') || n.endsWith('.zip')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M12 8v8M8 10l4-2 4 2"/></svg>
  if (m.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.md')) return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  // Generic file
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}

function FolderIcon({ size = 28, color = '#f59e0b' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color + '22'} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}

function formatSize(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DrivePage() {
  const { user } = useAuth()
  const [items, setItems] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string|null>(null)
  const [renamingId, setRenamingId] = useState<string|null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [currentFolder, setCurrentFolder] = useState<string>('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) load() }, [user, currentFolder])

  const folderPath = () => currentFolder ? `${user!.id}/${currentFolder}/` : `${user!.id}/`

  const load = async () => {
    if (!user) return
    setLoading(true); setError(null)
    const prefix = currentFolder ? `${currentFolder}/` : ''
    const { data, error: err } = await supabase.storage.from(BUCKET).list(user.id + (prefix ? `/${prefix.slice(0,-1)}` : ''), {
      limit: 200,
      sortBy: { column: 'updated_at', order: 'desc' },
    })
    if (err) {
      setError(err.message.includes('not found') || err.message.includes('does not exist')
        ? 'Drive bucket not set up. Create a bucket named "drive" in Supabase Storage, then add RLS policies.'
        : err.message)
      setLoading(false); return
    }
    const all = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder')
    // Separate folders (id null = folder) from files
    const folders = all.filter(f => !f.id).map(f => ({ ...f, isFolder: true }))
    const files = all.filter(f => f.id).map(f => ({ ...f, isFolder: false }))
    setItems([...folders, ...files])
    setLoading(false)
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files || [])
    if (!fs.length || !user) return
    setUploading(true); setError(null)
    for (const file of fs) {
      setUploadProgress(`Uploading ${file.name}…`)
      const folder = currentFolder ? `${currentFolder}/` : ''
      const path = `${user.id}/${folder}${Date.now()}_${file.name}`
      const { error: err } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (err) { setError(`Failed to upload ${file.name}: ${err.message}`); break }
    }
    setUploading(false); setUploadProgress(null)
    if (inputRef.current) inputRef.current.value = ''
    load()
  }

  const download = async (item: DriveItem) => {
    if (!user || item.isFolder) return
    const folder = currentFolder ? `${currentFolder}/` : ''
    const path = `${user.id}/${folder}${item.name}`
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (err || !data) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = getPublicName(item.name)
    a.click()
  }

  const deleteItem = async (item: DriveItem) => {
    if (!user) return
    setDeleting(item.name)
    const folder = currentFolder ? `${currentFolder}/` : ''
    if (item.isFolder) {
      // List and delete all files in folder
      const { data } = await supabase.storage.from(BUCKET).list(`${user.id}/${item.name}`)
      if (data?.length) {
        await supabase.storage.from(BUCKET).remove(data.map(f => `${user.id}/${item.name}/${f.name}`))
      }
    } else {
      await supabase.storage.from(BUCKET).remove([`${user.id}/${folder}${item.name}`])
    }
    setDeleting(null); load()
  }

  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return
    const folder = currentFolder ? `${currentFolder}/` : ''
    const path = `${user.id}/${folder}${newFolderName.trim()}/.emptyFolderPlaceholder`
    await supabase.storage.from(BUCKET).upload(path, new Blob([''], { type: 'text/plain' }))
    setNewFolderName(''); setShowNewFolder(false); load()
  }

  const startRename = (item: DriveItem) => {
    if (item.isFolder) return
    setRenamingId(item.name); setRenameVal(getPublicName(item.name))
  }

  const commitRename = async (item: DriveItem) => {
    if (!user || !renameVal.trim() || renamingId !== item.name) { setRenamingId(null); return }
    const folder = currentFolder ? `${currentFolder}/` : ''
    const oldPath = `${user.id}/${folder}${item.name}`
    const newName = `${Date.now()}_${renameVal.trim()}`
    const newPath = `${user.id}/${folder}${newName}`
    // Copy then delete
    const { data: dlData } = await supabase.storage.from(BUCKET).download(oldPath)
    if (dlData) {
      await supabase.storage.from(BUCKET).upload(newPath, dlData)
      await supabase.storage.from(BUCKET).remove([oldPath])
    }
    setRenamingId(null); load()
  }

  const getPublicName = (name: string) => name.replace(/^\d+_/, '')
  const breadcrumbs = currentFolder ? currentFolder.split('/') : []

  const filtered = items.filter(f => getPublicName(f.name).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <p className="page-eyebrow">Storage</p>
          <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Drive</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{items.filter(f => !f.isFolder).length} files · {items.filter(f => f.isFolder).length} folders</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.68)', border: '1px solid rgba(200,210,240,0.5)', borderRadius: 12, padding: 3 }}>
            {(['grid','list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: viewMode === v ? 'white' : 'transparent', color: viewMode === v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: viewMode === v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
                {v === 'grid' ? 'Grid' : 'List'}
              </button>
            ))}
          </div>
          <button className="glass-button" onClick={() => setShowNewFolder(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline' }}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            New folder
          </button>
          <button className="glass-button-primary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, display: 'inline' }}><line x1="12" y1="16" x2="12" y2="4"/><polyline points="8 8 12 4 16 8"/><path d="M20 21H4"/></svg>
            {uploading ? (uploadProgress || 'Uploading…') : 'Upload'}
          </button>
          <input ref={inputRef} type="file" multiple onChange={upload} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13 }}>
        <button onClick={() => setCurrentFolder('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: currentFolder ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 560, fontFamily: 'Geist, sans-serif', fontSize: 13, padding: '4px 8px', borderRadius: 7, transition: 'background 0.15s' }}>Drive</button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <button onClick={() => setCurrentFolder(breadcrumbs.slice(0, i+1).join('/'))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--accent)', fontWeight: 560, fontFamily: 'Geist, sans-serif', fontSize: 13, padding: '4px 8px', borderRadius: 7 }}>{crumb}</button>
          </span>
        ))}
      </div>

      {/* Search + New folder form */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files…" style={{ maxWidth: 280 }} />
        {showNewFolder && (
          <div style={{ display: 'flex', gap: 7, animation: 'fadeIn 0.2s ease' }}>
            <input className="glass-input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name…" autoFocus onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') } }} style={{ width: 180 }} />
            <button className="glass-button-primary" onClick={createFolder} style={{ padding: '8px 14px', fontSize: 13 }}>Create</button>
            <button className="glass-button" onClick={() => { setShowNewFolder(false); setNewFolderName('') }} style={{ padding: '8px 12px' }}>✕</button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#dc2626', fontSize: 13.5, marginBottom: 18, lineHeight: 1.6 }}>⚠️ {error}</div>}

      {/* Drop zone */}
      <div
        className="glass-card fade-up"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)' }}
        onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
        onDrop={async e => {
          e.preventDefault(); (e.currentTarget as HTMLElement).style.background = ''
          if (!user) return
          const fs = Array.from(e.dataTransfer.files); if (!fs.length) return
          setUploading(true)
          for (const file of fs) {
            const folder = currentFolder ? `${currentFolder}/` : ''
            await supabase.storage.from(BUCKET).upload(`${user.id}/${folder}${Date.now()}_${file.name}`, file, { upsert: true })
          }
          setUploading(false); load()
        }}
        style={{ padding: '20px', marginBottom: 20, cursor: 'pointer', textAlign: 'center', border: '1.5px dashed rgba(99,102,241,0.22)', transition: 'all 0.2s' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mid)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
        <p style={{ fontSize: 13.5, fontWeight: 520, color: 'var(--text-secondary)' }}>{uploading ? (uploadProgress || 'Uploading…') : 'Click or drag & drop files'}</p>
      </div>

      {/* Items */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(175px, 1fr))' : '1fr', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: viewMode === 'grid' ? 150 : 52, animationDelay: `${i * 50}ms` }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '56px 0', textAlign: 'center' }}>
          <FolderIcon size={44} color="#6366f1" />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 520, marginTop: 14 }}>{search ? 'No files match your search' : currentFolder ? 'This folder is empty' : 'No files yet'}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Upload something to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))', gap: 13 }}>
          {filtered.map((item, i) => {
            const pubName = getPublicName(item.name)
            return (
              <div key={item.name} className="file-card" style={{ animation: `fadeUp 0.35s ease ${i * 30}ms both` }} onDoubleClick={() => item.isFolder ? setCurrentFolder(currentFolder ? `${currentFolder}/${item.name}` : item.name) : startRename(item)}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  {item.isFolder ? <FolderIcon size={36} /> : <FileIcon mime={item.metadata?.mimetype} name={pubName} size={34} />}
                </div>
                {renamingId === item.name ? (
                  <input value={renameVal} onChange={e => setRenameVal(e.target.value)} onBlur={() => commitRename(item)} onKeyDown={e => { if (e.key === 'Enter') commitRename(item); if (e.key === 'Escape') setRenamingId(null) }} autoFocus style={{ width: '100%', border: 'none', borderBottom: '1.5px solid var(--accent)', outline: 'none', background: 'transparent', fontSize: 12.5, fontFamily: 'Geist, sans-serif', color: 'var(--text-primary)', textAlign: 'center', marginBottom: 4 }} />
                ) : (
                  <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3, textAlign: 'center' }} title={pubName}>{pubName}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
                  {item.isFolder ? 'Folder' : formatSize(item.metadata?.size)} · {formatDate(item.updated_at)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!item.isFolder && (
                    <button onClick={e => { e.stopPropagation(); download(item) }} style={{ flex: 1, padding: '6px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-deep)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontWeight: 500, transition: 'all 0.15s' }}>Download</button>
                  )}
                  {item.isFolder && (
                    <button onClick={e => { e.stopPropagation(); setCurrentFolder(currentFolder ? `${currentFolder}/${item.name}` : item.name) }} style={{ flex: 1, padding: '6px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-deep)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontWeight: 500, transition: 'all 0.15s' }}>Open</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteItem(item) }} disabled={deleting === item.name} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', transition: 'all 0.15s' }}>{deleting === item.name ? '…' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((item, i) => {
            const pubName = getPublicName(item.name)
            return (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(99,102,241,0.06)' : 'none', animation: `fadeUp 0.3s ease ${i * 22}ms both` }} onDoubleClick={() => item.isFolder ? setCurrentFolder(currentFolder ? `${currentFolder}/${item.name}` : item.name) : startRename(item)}>
                <div style={{ flexShrink: 0 }}>{item.isFolder ? <FolderIcon size={22} /> : <FileIcon mime={item.metadata?.mimetype} name={pubName} size={22} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === item.name ? (
                    <input value={renameVal} onChange={e => setRenameVal(e.target.value)} onBlur={() => commitRename(item)} onKeyDown={e => { if (e.key === 'Enter') commitRename(item); if (e.key === 'Escape') setRenamingId(null) }} autoFocus style={{ width: '100%', border: 'none', borderBottom: '1.5px solid var(--accent)', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'Geist, sans-serif', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()} />
                  ) : (
                    <div style={{ fontSize: 13.5, fontWeight: 520, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pubName}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.isFolder ? 'Folder' : formatSize(item.metadata?.size)} · {formatDate(item.updated_at)}</div>
                </div>
                {!item.isFolder && <button onClick={() => download(item)} style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-deep)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontWeight: 500, flexShrink: 0 }}>Download</button>}
                {item.isFolder && <button onClick={() => setCurrentFolder(currentFolder ? `${currentFolder}/${item.name}` : item.name)} style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-deep)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontWeight: 500, flexShrink: 0 }}>Open</button>}
                <button onClick={() => deleteItem(item)} disabled={deleting === item.name} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>{deleting === item.name ? '…' : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}</button>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
        💡 Double-click a file to rename it · Double-click a folder to open it
      </p>
    </div>
  )
}
