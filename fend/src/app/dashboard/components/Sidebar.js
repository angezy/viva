"use client"

import React, { useEffect, useState } from 'react'
import styles from './sidebar.module.css'
import LinkOne from './LinkOne'
import LinkTwo from './LinkTwo'
import LinkThree from './LinkThree'
import LinkFour from './LinkFour'
import LinkFive from './LinkFive'
import LinkSix from './LinkSix'
import LinkSeven from './LinkSeven'
import LinkEight from './LinkEight'
import LinkDashboard from './LinkDashboard'

export default function Sidebar({ open = true, onClose = () => {} }) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    setIsDesktop(mq.matches)
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else mq.addListener(handler)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else mq.removeListener(handler)
    }
  }, [])

  const sidebarWidth = 220

  const desktopStyle = {
    position: 'relative',
    transform: 'none',
    transition: 'none',
    width: sidebarWidth,
    minWidth: sidebarWidth
  }

  const mobileStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 50,
    width: sidebarWidth,
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 200ms ease-in-out'
  }

  return (
    <>
      {!isDesktop && (
        <div
          onClick={onClose}
          style={{
            display: open ? 'block' : 'none',
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 40
          }}
        />
      )}

      <aside
        className={styles.sidebar}
        style={isDesktop ? desktopStyle : mobileStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className={styles.logo}>My Dashboard</div>
          {!isDesktop && (
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 20
              }}
            >
              ×
            </button>
          )}
        </div>

        <nav className={styles.nav} style={{ marginTop: 16 }}>
          <ul>
            <li><LinkDashboard /></li>
            <li><LinkOne /></li>
            <li><LinkTwo /></li>
            <li><LinkThree /></li>
            <li><LinkFour /></li>
            <li><LinkFive /></li>
            <li><LinkSix /></li>
            <li><LinkSeven /></li>
            <li><LinkEight /></li>
          </ul>
        </nav>
      </aside>
    </>
  )
}
