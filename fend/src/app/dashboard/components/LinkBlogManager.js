import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkBlogManager() {
  return (
    <Link className={styles.link} href="/dashboard/blogManager">
      Blog Manager
    </Link>
  )
}
