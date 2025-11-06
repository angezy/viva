import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkTwo(){
  return <Link className={styles.link} href="/dashboard/item2">Reports</Link>
}
