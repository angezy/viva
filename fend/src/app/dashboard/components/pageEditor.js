import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function pageEditor(){
  return <Link className={styles.link} href="/dashboard/pageEditor">Page Editor</Link>
}
