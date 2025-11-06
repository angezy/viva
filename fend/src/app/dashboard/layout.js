import React from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_NAME, verifyToken } from '../../lib/auth'
import ClientDashboardLayout from './ClientDashboardLayout'

export default async function DashboardLayout({ children }) {
  // server-side check for auth cookie (await cookies() per Next.js requirement)
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get(COOKIE_NAME)
  const token = tokenCookie?.value
  const user = token ? verifyToken(token) : null

  if (!user) {
    // not authenticated - redirect to sign in
    redirect('/signin')
  }

  return <ClientDashboardLayout>{children}</ClientDashboardLayout>
}
