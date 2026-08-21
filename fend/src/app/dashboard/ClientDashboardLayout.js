"use client"

import React, { useState } from 'react'
import AppBar from './components/AppBar'
import Sidebar from './components/Sidebar'
import { useEffect } from 'react'
import { endLiveChatSession } from '../lib/chatSession'

export default function ClientDashboardLayout({ children }) {
  const [open, setOpen] = useState(true)
  const [siteName, setSiteName] = useState('Weluxo')

  useEffect(() => {
    fetch('/api/site-settings', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((settings) => settings?.siteName && setSiteName(settings.siteName))
      .catch(() => undefined)
  }, [])

  const toggle = () => setOpen(v => !v)
  const close = () => setOpen(false)

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      await endLiveChatSession()
      window.location.href = '/api/auth/signout?role=admin'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ display: 'flex', flex: 1, alignItems: 'stretch', background: '#f8fafc' }}>
        <Sidebar open={open} onClose={close} siteName={siteName} />
        <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', background: '#f8fafc' }}>
          <AppBar onToggleSidebar={toggle} onSignOut={signOut} siteName={siteName} />
          {children}
        </main>
      </div>
    </div>
  )
}
