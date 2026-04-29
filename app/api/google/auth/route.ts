import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return new NextResponse('<h2>GOOGLE_CLIENT_ID not set in env vars</h2>', { headers: { 'Content-Type': 'text/html' } })
  }

  const redirectUri = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/api/google/callback`
    : `https://${process.env.VERCEL_URL}/api/google/callback`

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ].join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent') // always return refresh_token

  return NextResponse.redirect(url.toString())
}
