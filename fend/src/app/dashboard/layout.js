import React from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE_NAME, verifyToken } from '../../lib/auth'
import ClientDashboardLayout from './ClientDashboardLayout'

export default async function DashboardLayout({ children }) {
  // server-side check for auth cookie (await cookies() per Next.js requirement)
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get(ADMIN_COOKIE_NAME)
  const token = tokenCookie?.value
  // quick debug logging to help trace why token verification may fail
  try {
    // avoid printing the whole token in logs; show first/last parts
    const tokenPreview = token ? `${token.slice(0, 10)}...${token.slice(-6)}` : null
    console.log('[dashboard/layout] token present:', !!token, 'preview:', tokenPreview)
    console.log('[dashboard/layout] JWT_SECRET present:', !!process.env.JWT_SECRET)
  } catch (e) {
    console.log('[dashboard/layout] token preview error', e && e.message)
  }

  const user = token ? verifyToken(token) : null

  console.log('[dashboard/layout] verifyToken returned:', user ? { sub: user.sub, email: user.email, role: user.role } : null)

  if (!user || String(user.role || '').toLowerCase() !== 'admin') {
    // not authenticated or not an admin - redirect to admin sign in
    redirect('/signin/admin')
  }

  return <ClientDashboardLayout>{children}</ClientDashboardLayout>
}
