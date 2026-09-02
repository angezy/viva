"use client"

import React, { useState } from 'react'
import AppBar from './components/AppBar'
import Sidebar from './components/Sidebar'
import { endLiveChatSession } from '../lib/chatSession'
import { useSiteSettings } from '../components/SiteThemeProvider'
import { usePathname, useRouter } from 'next/navigation'

function DashboardAccessDenied() {
  return <main style={{ minHeight: '100%', padding: '64px 32px', background: '#f8fafc' }}><section style={{ maxWidth: 640, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32 }}><p style={{ color: '#64748b', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>403 · Access denied</p><h1 style={{ margin: '8px 0 12px', color: '#0f172a' }}>You do not have access to this dashboard area.</h1><p style={{ color: '#475569' }}>Ask the store owner to grant the required permission.</p></section></main>
}

function adminPathAllowed(pathname) {
  if (pathname === '/dashboard') return true
  return ['/dashboard/orders', '/dashboard/order', '/dashboard/user', '/dashboard/tikects'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export default function ClientDashboardLayout({ children, user }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const siteName = useSiteSettings().siteName || 'Your Store'
  const role = String(user?.role || '').toLowerCase()
  const pathname = usePathname() || ''

  const toggle = () => setOpen(v => !v)
  const close = () => setOpen(false)

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      await endLiveChatSession()
      await fetch('/api/auth/signout?role=admin', { method: 'POST' })
      router.push('/signin/admin')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'stretch', background: '#f8fafc' }}>
        <Sidebar open={open} onClose={close} siteName={siteName} role={role} />
        <main style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#f8fafc' }}>
          <AppBar onToggleSidebar={toggle} onSignOut={signOut} siteName={siteName} role={role} />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {role === 'admin' && !adminPathAllowed(pathname) ? <DashboardAccessDenied /> : children}
          </div>
        </main>
      </div>
    </div>
  )
}
