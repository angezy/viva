import { NextResponse } from 'next/server'
import { COOKIE_NAME, cookieOptions } from '../src/lib/auth'

export async function GET() {
  const res = NextResponse.redirect('/signin')
  // clear cookie by setting maxAge=0
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    maxAge: 0,
    path: '/',
  })
  return res
}

export async function POST() {
  return GET()
}
