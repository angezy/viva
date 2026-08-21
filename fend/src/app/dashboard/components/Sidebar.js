"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import LoyaltyOutlinedIcon from '@mui/icons-material/LoyaltyOutlined'
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import styles from './sidebar.module.css'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: SpaceDashboardOutlinedIcon },
  { label: 'Overview', href: '/dashboard/Overview', icon: PersonOutlineIcon },
  { label: 'Page Editor', href: '/dashboard/pageEditor', icon: TextSnippetOutlinedIcon },
  { label: 'Reviews', href: '/dashboard/reviews', icon: RateReviewOutlinedIcon },
  { label: 'Products', href: '/dashboard/products', icon: Inventory2OutlinedIcon },
  { label: 'Orders', href: '/dashboard/orders', icon: ReceiptLongOutlinedIcon },
  { label: 'Finance', href: '/dashboard/finance', icon: AccountBalanceOutlinedIcon },
  { label: 'Suppliers', href: '/dashboard/suppliers', icon: LocalShippingOutlinedIcon },
  { label: 'API Products', href: '/dashboard/api-products', icon: ExtensionOutlinedIcon },
  { label: 'Users', href: '/dashboard/user', icon: GroupOutlinedIcon },
  { label: 'Marketing', href: '/dashboard/marketing', icon: CampaignOutlinedIcon },
  { label: 'Coupons', href: '/dashboard/coupons', icon: LocalOfferOutlinedIcon },
  { label: 'Loyalty', href: '/dashboard/loyalty', icon: LoyaltyOutlinedIcon },
  { label: 'Settings', href: '/dashboard/Settings', icon: SettingsOutlinedIcon },
  { label: 'Messages', href: '/dashboard/item6', icon: ChatBubbleOutlineIcon },
  { label: 'Integrations', href: '/dashboard/item7', icon: ExtensionOutlinedIcon },
  { label: 'Help', href: '/dashboard/item8', icon: HelpOutlineIcon },
  { label: 'Blog Manager', href: '/dashboard/blogManager', icon: ArticleOutlinedIcon },
  { label: 'Support Tickets', href: '/dashboard/tikects', icon: SupportAgentOutlinedIcon }
]

export default function Sidebar({ open = true, onClose = () => {}, siteName = 'Weluxo' }) {
  const [isDesktop, setIsDesktop] = useState(false)
  const pathname = usePathname()

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

  const sidebarWidth = 240

  const desktopStyle = {
    position: 'relative',
    width: open ? sidebarWidth : 0,
    minWidth: open ? sidebarWidth : 0,
    transition: 'transform 200ms ease-in-out, opacity 200ms ease-in-out, width 200ms ease-in-out',
    transform: open ? 'translateX(0)' : 'translateX(-110%)',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none'
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

  const isActive = (href) => {
    if (!pathname) return false
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
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
            background: 'rgba(15,23,36,0.4)',
            zIndex: 40
          }}
        />
      )}

      <aside
        className={styles.sidebar}
        style={isDesktop ? desktopStyle : mobileStyle}
      >
        <div className={styles.header}>
          <div className={styles.logo}>{siteName}</div>
          {!isDesktop && (
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              className={styles.closeButton}
            >
              ×
            </button>
          )}
        </div>

        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map(({ label, href, icon: Icon }) => (
              <li key={href} className={styles.navItem}>
                <Link
                  href={href}
                  className={`${styles.navLink} ${isActive(href) ? styles.active : ''}`}
                  onClick={!isDesktop ? onClose : undefined}
                >
                  <span className={styles.iconBox}>
                    <Icon fontSize="small" />
                  </span>
                  <span className={styles.label}>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
