'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type DriveFile = {
  name: string
  id: string
  updated_at: string
  created_at: string
  metadata?: { size?: number; mimetype?: string }
}

const BUCKET = 'drive'

function getFileIcon(mime?: string, name?: string): string {
  const m = mime || ''
  const n = (name || '').toLowerCase()
  if (m.startsWith('image/')) return '🖼'
  if (m === 'application/pdf' || n.endsWith('.pdf')) return '📄'
  if (m.includes('spreadsheet') || n.endsWith('.xlsx') || n.endsWith('.csv')) return '📊'
  if (m.includes('presentation') || n.endsWith('.pptx')) return '📑'
  if (m.includes('word') || n.endsWith('.docx')) return '📝'
  if (m.startsWith('video/')) return '🎬'
  if (m.startsWith('audio/')) return '🎵'
  if (m.includes('zip') || m.includes('archive')) return '📦'
  if (m.startsWith('text/')) return '📃'
  return '📁'
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DrivePage() {
  const { user } = useAuth()
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) load() }, [user])

  const load = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.storage.from(BUCKET).list(user.id, {
      limit: 200,
      sortBy: { column: 'updated_at', order: 'desc' },
    })
    if (err) {
      setError(err.message.includes('not found') || err.message.includes('does not exist')
        ? 'Drive bucket not set up yet. Please create a bucket named "drive" in your Supabase Storage dashboard.'
        : err.message)
      setLoading(false)
      return
    }
    setFiles((data || []).filter(f => f.name !== '.emptyFolderPlaceholder'))
    setLoading(false)
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (!selectedFiles.length || !user) return
    setUploading(true)
    setError(null)
    for (const file of selectedFiles) {
      setUploadProgress(`Uploading ${file.name}…`)
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error: err } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (err) { setError(`Failed to upload ${file.name}: ${err.message}`); break }
    }
    setUploading(false)
    setUploadProgress(null)
    if (inputRef.current) inputRef.current.value = ''
    load()
  }

  const download = async (file: DriveFile) => {
    if (!user) return
    const path = `${user.id}/${file.name}`
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (err || !data) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = file.name.replace(/^\d+_/, '') // strip timestamp prefix
    a.click()
  }

  const deleteFile = async (file: DriveFile) => {
    if (!user) return
    setDeleting(file.name)
    const path = `${user.id}/${file.name}`
    await supabase.storage.from(BUCKET).remove([path])
    setDeleting(null)
    load()
  }

  const getPublicName = (name: string) => name.replace(/^\d+_/, '')

  const filtered = files.filter(f => getPublicName(f.name).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <p className="page-eyebrow">Storage</p>
          <h1 style={{ fontSize: 28, fontWeight: 680, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Drive</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{files.length} {files.length === 1 ? 'file' : 'files'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.68)', border: '1px solid rgba(200,210,240,0.5)', borderRadius: 12, padding: 3 }}>
            {(['grid','list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: viewMode === v ? 'white' : 'transparent', color: viewMode === v ? 'var(--accent-deep)' : 'var(--text-muted)', boxShadow: viewMode === v ? '0 2px 8px rgba(80,100,200,0.12)' : 'none' }}>
                {v === 'grid' ? '⊞ Grid' : '☰ List'}
              </button>
            ))}
          </div>
          <button
            className="glass-button-primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (uploadProgress || 'Uploading…') : '↑ Upload'}
          </button>
          <input ref={inputRef} type="file" multiple onChange={upload} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Search */}
      <div className="fade-up" style={{ marginBottom: 18 }}>
        <input
          className="glass-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files…"
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#dc2626', fontSize: 13.5, marginBottom: 18, lineHeight: 1.5 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Upload drop zone */}
      <div
        className="glass-card fade-up"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
        onDragLeave={e => { e.currentTarget.style.background = '' }}
        onDrop={async e => {
          e.preventDefault()
          e.currentTarget.style.background = ''
          if (!user) return
          const droppedFiles = Array.from(e.dataTransfer.files)
          if (!droppedFiles.length) return
          setUploading(true)
          for (const file of droppedFiles) {
            setUploadProgress(`Uploading ${file.name}…`)
            const path = `${user.id}/${Date.now()}_${file.name}`
            await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
          }
          setUploading(false); setUploadProgress(null); load()
        }}
        style={{ padding: '22px', marginBottom: 20, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', border: '1.5px dashed rgba(99,102,241,0.22)' }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>☁️</div>
        <p style={{ fontSize: 13.5, fontWeight: 520, color: 'var(--text-secondary)' }}>
          {uploading ? (uploadProgress || 'Uploading…') : 'Click to upload or drag & drop files here'}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Any file type · No size limit</p>
      </div>

      {/* Files */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(180px, 1fr))' : '1fr', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: viewMode === 'grid' ? 140 : 52, animationDelay: `${i * 60}ms` }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '56px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 520 }}>{search ? 'No files match your search' : 'No files yet'}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Upload something to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 13 }}>
          {filtered.map((file, i) => {
            const publicName = getPublicName(file.name)
            const mime = file.metadata?.mimetype
            const icon = getFileIcon(mime, publicName)
            return (
              <div key={file.name} className="file-card" style={{ animation: `fadeUp 0.35s ease ${i * 35}ms both` }}>
                <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>{icon}</div>
                <div style={{ fontSize: 12.5, fontWeight: 560, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={publicName}>{publicName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {formatSize(file.metadata?.size)} · {formatDate(file.updated_at)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={e => { e.stopPropagation(); download(file) }}
                    style={{ flex: 1, padding: '6px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-deep)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontWeight: 500, transition: 'all 0.15s' }}
                  >↓ Save</button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteFile(file) }}
                    disabled={deleting === file.name}
                    style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', transition: 'all 0.15s' }}
                  >{deleting === file.name ? '…' : '🗑'}</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((file, i) => {
            const publicName = getPublicName(file.name)
            const mime = file.metadata?.mimetype
            const icon = getFileIcon(mime, publicName)
            return (
              <div key={file.name} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(99,102,241,0.06)' : 'none',
                transition: 'background 0.15s', animation: `fadeUp 0.3s ease ${i * 25}ms both`,
              }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 520, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{publicName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{formatSize(file.metadata?.size)} · {formatDate(file.updated_at)}</div>
                </div>
                <button
                  onClick={() => download(file)}
                  style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', color: 'var(--accent-deep)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontWeight: 500, flexShrink: 0, transition: 'all 0.15s' }}
                >↓ Download</button>
                <button
                  onClick={() => deleteFile(file)}
                  disabled={deleting === file.name}
                  style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Geist, sans-serif', flexShrink: 0, transition: 'all 0.15s' }}
                >{deleting === file.name ? '…' : '🗑'}</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Setup note */}
      {!error && !loading && (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
          Files are stored privately per account · Requires a <code style={{ background: 'rgba(99,102,241,0.08)', padding: '1px 5px', borderRadius: 4 }}>drive</code> bucket in Supabase Storage with per-user path RLS
        </p>
      )}
    </div>
  )
}
