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

  const user = token ? verifyToken(token) : null

 const role = String(user?.role || user?.accountRole || '').toLowerCase();
 if (!user || !['owner', 'admin'].includes(role)) {
    // Customers and unauthenticated visitors never enter the staff shell.
    redirect('/signin/admin')
  }

  return <ClientDashboardLayout user={{ ...user, role }}>{children}</ClientDashboardLayout>
}
