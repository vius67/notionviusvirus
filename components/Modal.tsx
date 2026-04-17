'use client'
import { useEffect, ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
}

export default function Modal({ open, onClose, title, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,12,36,0.22)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.96)',
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(60,80,200,0.16), 0 2px 8px rgba(0,0,0,0.04)',
        animation: 'scaleIn 0.28s cubic-bezier(0.22,1,0.36,1)',
        width, maxWidth: '96vw',
        maxHeight: '88vh', overflowY: 'auto',
        padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 650, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'rgba(0,0,0,0.05)', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 16, transition: 'all 0.15s' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
