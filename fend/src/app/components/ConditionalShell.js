"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import Header from './Header'
import Footer from './footer'

export default function ConditionalShell({ children }) {
  const pathname = usePathname()
  const hideShell = pathname?.startsWith('/dashboard')

  return (
    <>
      {!hideShell && <Header />}
      {children}
      {!hideShell && <Footer />}
    </>
  )
}
