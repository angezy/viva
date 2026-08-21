"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import Header from './Header'
import Footer from './footer'
import HelpChatWidget from './HelpChatWidget'
import CookieConsentBanner from './CookieConsentBanner'
import WelcomeOfferPopup from './WelcomeOfferPopup'

export default function ConditionalShell({ children }) {
  const pathname = usePathname()
  const hideShell = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')

  return (
    <>
      {!hideShell && <Header />}
      {children}
      {!hideShell && <Footer />}
      {!hideShell && <CookieConsentBanner />}
      {!hideShell && <WelcomeOfferPopup />}
      <HelpChatWidget />
    </>
  )
}
