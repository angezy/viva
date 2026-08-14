import { NextResponse } from 'next/server'
import { COOKIE_NAME, getAuthCookieOptions } from '../../../../lib/auth'

export async function GET(req) {
  const res = NextResponse.redirect(new URL('/signin', req.url))
  res.cookies.set(COOKIE_NAME, '', getAuthCookieOptions(0))
  return res
}

export async function POST(request) {
  return GET(request)
}
