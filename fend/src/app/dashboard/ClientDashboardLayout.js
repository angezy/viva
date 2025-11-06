"use client"

import React, { useState } from 'react'
import AppBar from '../components/AppBar'
import Sidebar from '../components/Sidebar'

export default function ClientDashboardLayout({ children }) {
  const [open, setOpen] = useState(true)

  const toggle = () => setOpen(v => !v)
  const close = () => setOpen(false)

  const signOut = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/signout'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar open={open} onClose={close} />
        <main style={{ flex: 1 }}>
          <AppBar onToggleSidebar={toggle} onSignOut={signOut} />
          {children}
        </main>
      </div>
    </div>
  )
}
