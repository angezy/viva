import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, CUSTOMER_COOKIE_NAME, getAuthCookieOptions } from '../../../../lib/auth'
import { proxyRequest } from '../../../lib/backendProxy'

function clearSession(req) {
  const isAdmin = new URL(req.url).searchParams.get('role') === 'admin'
  const res = NextResponse.redirect(new URL(isAdmin ? '/signin/admin' : '/signin', req.url))
  res.cookies.set(isAdmin ? ADMIN_COOKIE_NAME : CUSTOMER_COOKIE_NAME, '', getAuthCookieOptions(0))
  // Remove the old shared cookie left by earlier versions of the app.
  res.cookies.set('viva_token', '', getAuthCookieOptions(0))
  return res
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST to sign out' }, { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Request origin could not be verified' }, { status: 403 })
  }
  const upstream = await proxyRequest(request, ['api', 'logout'])
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Session could not be revoked' }, { status: upstream.status === 401 ? 401 : 503 })
  }
  return clearSession(request)
}
