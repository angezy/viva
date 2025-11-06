import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkEight(){
  return <Link className={styles.link} href="/dashboard/item8">Help</Link>
}
