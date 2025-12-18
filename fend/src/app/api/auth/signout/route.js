import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '../../../../lib/auth'

export async function GET(req) {
  const res = NextResponse.redirect(new URL('/signin', req.url))
  // clear cookie by setting maxAge=0
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
  })
  return res
}

export async function POST() {
  return GET()
}
