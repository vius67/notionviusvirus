'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage(''); setSubmitting(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.replace('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    }
    setSubmitting(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } })
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:32,height:32,border:'2px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
      <div className="grid-bg"/>
      <div style={{position:'fixed',top:'10%',left:'15%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle, rgba(123,158,240,0.12) 0%, transparent 70%)',pointerEvents:'none'}}/>
      <div style={{position:'fixed',bottom:'15%',right:'10%',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)',pointerEvents:'none'}}/>
      <div className="glass-card scale-in" style={{width:400,maxWidth:'95vw',padding:40,position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg, #7B9EF0, #a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:22,fontWeight:700,color:'white',boxShadow:'0 8px 24px rgba(123,158,240,0.35)'}}>B</div>
          <h1 style={{fontSize:22,fontWeight:600,color:'var(--text-primary)',letterSpacing:'-0.02em'}}>BEAM Portal</h1>
          <p style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>Your academic command centre</p>
        </div>
        <div style={{display:'flex',background:'rgba(123,158,240,0.08)',borderRadius:10,padding:3,marginBottom:24}}>
          {(['login','signup'] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:'7px 0',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'DM Sans,sans-serif',transition:'all 0.2s',background:mode===m?'white':'transparent',color:mode===m?'var(--accent-deep)':'var(--text-muted)',boxShadow:mode===m?'0 2px 8px rgba(100,120,200,0.1)':'none'}}>
              {m==='login'?'Sign in':'Sign up'}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:500,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Email</label>
            <input className="glass-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:12,fontWeight:500,color:'var(--text-secondary)',display:'block',marginBottom:6}}>Password</label>
            <input className="glass-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={6}/>
          </div>
          {error&&<p style={{fontSize:13,color:'#ef4444',marginBottom:12,background:'rgba(239,68,68,0.06)',padding:'8px 12px',borderRadius:8}}>{error}</p>}
          {message&&<p style={{fontSize:13,color:'#22c55e',marginBottom:12,background:'rgba(34,197,94,0.06)',padding:'8px 12px',borderRadius:8}}>{message}</p>}
          <button type="submit" className="glass-button-primary" disabled={submitting} style={{width:'100%',padding:'11px',fontSize:14}}>{submitting?'Loading...':mode==='login'?'Sign in':'Create account'}</button>
        </form>
        <div style={{display:'flex',alignItems:'center',gap:12,margin:'16px 0'}}>
          <div style={{flex:1,height:1,background:'rgba(123,158,240,0.15)'}}/>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>or</span>
          <div style={{flex:1,height:1,background:'rgba(123,158,240,0.15)'}}/>
        </div>
        <button onClick={handleGoogle} className="glass-button" style={{width:'100%',padding:'11px',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
