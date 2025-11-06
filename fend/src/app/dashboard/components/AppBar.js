"use client"

import React from 'react'

export default function AppBar({ onToggleSidebar, onSignOut }) {
  return (
    <header style={{
      height: 64,
      background: '#071126',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      zIndex: 50
    }}>
      <button
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 8,
          marginRight: 12,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {/* simple hamburger icon */}
        <span style={{ display: 'block', width: 20 }}>
          <span style={{ display: 'block', height: 2, background: '#fff', margin: '4px 0' }} />
          <span style={{ display: 'block', height: 2, background: '#fff', margin: '4px 0' }} />
          <span style={{ display: 'block', height: 2, background: '#fff', margin: '4px 0' }} />
        </span>
      </button>

      <div style={{ fontWeight: 700 }}>My App</div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onSignOut}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
