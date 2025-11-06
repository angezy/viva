import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function LinkSeven(){
  return <Link className={styles.link} href="/dashboard/item7">Integrations</Link>
}
