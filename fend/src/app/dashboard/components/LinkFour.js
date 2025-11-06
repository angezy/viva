import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkFour(){
  return <Link className={styles.link} href="/dashboard/item4">Users</Link>
}
