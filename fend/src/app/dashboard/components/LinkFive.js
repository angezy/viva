import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkFive(){
  return <Link className={styles.link} href="/dashboard/Settings">Settings</Link>
}
