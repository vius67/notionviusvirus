const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
const REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/dashboard/spotify`
  : ''

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-recently-played',
].join(' ')

// ── PKCE helpers ──────────────────────────────────────────────
function genRandom(len: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  return Array.from(buf).map(b => chars[b % chars.length]).join('')
}

async function sha256(s: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
}

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Auth ──────────────────────────────────────────────────────
export async function redirectToSpotify() {
  const verifier = genRandom(128)
  const state = genRandom(16)
  localStorage.setItem('sp_verifier', verifier)
  localStorage.setItem('sp_state', state)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: b64url(await sha256(verifier)),
    state,
    scope: SCOPES,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeCode(code: string): Promise<boolean> {
  const verifier = localStorage.getItem('sp_verifier')
  if (!verifier) return false
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return false
  saveTokens(await res.json())
  localStorage.removeItem('sp_verifier')
  localStorage.removeItem('sp_state')
  return true
}

function saveTokens(d: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem('sp_at', d.access_token)
  if (d.refresh_token) localStorage.setItem('sp_rt', d.refresh_token)
  localStorage.setItem('sp_exp', String(Date.now() + d.expires_in * 1000))
}

export async function getToken(): Promise<string | null> {
  const at = localStorage.getItem('sp_at')
  if (!at) return null
  if (Date.now() > Number(localStorage.getItem('sp_exp')) - 300_000) return doRefresh()
  return at
}

async function doRefresh(): Promise<string | null> {
  const rt = localStorage.getItem('sp_rt')
  if (!rt) { disconnect(); return null }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: rt }),
  })
  if (!res.ok) { disconnect(); return null }
  const d = await res.json()
  saveTokens(d)
  return d.access_token
}

export function isConnected() { return !!localStorage.getItem('sp_at') }

export function disconnect() {
  ['sp_at', 'sp_rt', 'sp_exp', 'sp_verifier', 'sp_state'].forEach(k => localStorage.removeItem(k))
}

// ── API ───────────────────────────────────────────────────────
async function api(path: string, opts?: RequestInit) {
  const token = await getToken()
  if (!token) return null
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...opts?.headers },
  })
  if (res.status === 204 || res.status === 202) return null
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export const getPlayer       = () => api('/me/player')
export const getNowPlaying   = () => api('/me/player/currently-playing')
export const getRecent       = () => api('/me/player/recently-played?limit=12')
export const cmdPlay         = () => api('/me/player/play',     { method: 'PUT' })
export const cmdPause        = () => api('/me/player/pause',    { method: 'PUT' })
export const cmdNext         = () => api('/me/player/next',     { method: 'POST' })
export const cmdPrev         = () => api('/me/player/previous', { method: 'POST' })
export const cmdSeek  = (ms: number)  => api(`/me/player/seek?position_ms=${ms}`,           { method: 'PUT' })
export const cmdVolume = (pct: number) => api(`/me/player/volume?volume_percent=${pct}`,     { method: 'PUT' })
export const cmdShuffle = (on: boolean) => api(`/me/player/shuffle?state=${on}`,             { method: 'PUT' })
export const cmdRepeat  = (m: string)   => api(`/me/player/repeat?state=${m}`,               { method: 'PUT' })
