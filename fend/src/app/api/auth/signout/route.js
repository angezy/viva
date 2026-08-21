import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, CUSTOMER_COOKIE_NAME, getAuthCookieOptions } from '../../../../lib/auth'

export async function GET(req) {
  const isAdmin = new URL(req.url).searchParams.get('role') === 'admin'
  const res = NextResponse.redirect(new URL(isAdmin ? '/signin/admin' : '/signin', req.url))
  res.cookies.set(isAdmin ? ADMIN_COOKIE_NAME : CUSTOMER_COOKIE_NAME, '', getAuthCookieOptions(0))
  // Remove the old shared cookie left by earlier versions of the app.
  res.cookies.set('viva_token', '', getAuthCookieOptions(0))
  return res
}

export async function POST(request) {
  return GET(request)
}
