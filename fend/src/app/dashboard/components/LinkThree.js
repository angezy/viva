import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkThree(){
  return <Link className={styles.link} href="/dashboard/item3">Analytics</Link>
}
