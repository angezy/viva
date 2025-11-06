import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkSix(){
  return <Link className={styles.link} href="/dashboard/item6">Messages</Link>
}
