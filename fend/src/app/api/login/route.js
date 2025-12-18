import { NextResponse } from 'next/server'

// Proxy POST /api/login to backend and forward token cookie to client
export async function POST(req) {
  try {
    const body = await req.json()

    const backendRes = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // server-side fetch doesn't need credentials
    })

    const raw = await backendRes.text()
    let data = null
    try { data = JSON.parse(raw) } catch (e) { data = null }

    const res = NextResponse.json(data || { message: raw || 'OK' }, { status: backendRes.status })

    // Collect any Set-Cookie headers the backend returned and mirror the
    // `viva_token` cookie onto the Next.js domain so server-side cookies()
    // can read it in layouts (avoid cross-origin cookie visibility issues).
    const setCookies = []
    for (const [k, v] of backendRes.headers) {
      if (k && k.toLowerCase() === 'set-cookie') setCookies.push(v)
    }

    // If backend returned token in JSON body, prefer that
    if (data && data.token) {
      res.cookies.set('viva_token', data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60
      })
    } else if (setCookies.length) {
      for (const cookieStr of setCookies) {
        // cookieStr is like: "viva_token=abc; Path=/; HttpOnly; ..."
        const first = cookieStr.split(';', 1)[0] // 'viva_token=abc'
        const idx = first.indexOf('=')
        if (idx > 0) {
          const name = first.substring(0, idx).trim()
          const val = first.substring(idx + 1)
          if (name === 'viva_token') {
            res.cookies.set('viva_token', val, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              sameSite: 'lax',
              maxAge: 60 * 60
            })
            break
          }
        }
      }
    }

    return res
  } catch (err) {
    return NextResponse.json({ error: err && err.message ? err.message : 'proxy error' }, { status: 500 })
  }
}
