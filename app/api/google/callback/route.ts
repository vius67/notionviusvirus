import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(`<h2>❌ Google denied access: ${error}</h2>`, { headers: { 'Content-Type': 'text/html' } })
  }
  if (!code) {
    return new NextResponse('<h2>❌ No code returned from Google</h2>', { headers: { 'Content-Type': 'text/html' } })
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri  = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/api/google/callback`
    : `https://${process.env.VERCEL_URL}/api/google/callback`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  const data = await res.json() as { refresh_token?: string; error?: string }

  if (!data.refresh_token) {
    return new NextResponse(`
      <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px">
        <h2>⚠️ No refresh token received</h2>
        <p>Go to <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>, remove access for your app, then visit <code>/api/google/auth</code> again.</p>
        <pre style="background:#f5f5f5;padding:12px;border-radius:6px">${JSON.stringify(data, null, 2)}</pre>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  }

  return new NextResponse(`
    <html><body style="font-family:sans-serif;max-width:620px;margin:40px auto;padding:0 20px">
      <h2>✅ Google Calendar connected!</h2>
      <p>Add this to <strong>Vercel → Environment Variables</strong> then redeploy:</p>
      <pre style="background:#f0fdf4;border:1px solid #86efac;padding:16px;border-radius:8px;font-size:13px;word-break:break-all">GOOGLE_REFRESH_TOKEN=${data.refresh_token}</pre>
      <p style="color:#6b7280;font-size:13px">You can close this tab after copying the value above.</p>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } })
}
