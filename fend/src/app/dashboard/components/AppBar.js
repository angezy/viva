"use client"

import React from 'react'

export default function AppBar({ onToggleSidebar, onSignOut, siteName = 'Your Store', role = 'owner' }) {
  return (
    <header style={{
      height: 64,
      flexShrink: 0,
      background: '#ffffff',
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 18px',
      boxShadow: '0 1px 6px rgba(15,23,36,0.08)',
      zIndex: 50,
      borderBottom: '1px solid #e2e8f0'
    }}>
      <button
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        style={{
          background: 'transparent',
          border: '1px solid #e2e8f0',
          color: 'inherit',
          cursor: 'pointer',
          padding: 8,
          marginRight: 12,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 10
        }}
      >
        {/* simple hamburger icon */}
        <span style={{ display: 'block', width: 20 }}>
          <span style={{ display: 'block', height: 2, background: '#0f172a', margin: '4px 0' }} />
          <span style={{ display: 'block', height: 2, background: '#0f172a', margin: '4px 0' }} />
          <span style={{ display: 'block', height: 2, background: '#0f172a', margin: '4px 0' }} />
        </span>
      </button>

      <div style={{ fontWeight: 700 }}>{siteName} {role === 'admin' ? 'Operator' : 'Owner'} Dashboard</div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onSignOut}
          style={{
            background: 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            letterSpacing: '0.01em'
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
