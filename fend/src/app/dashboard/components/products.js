import React from 'react'
import styles from './link.module.css'
import Link from 'next/link'

export default function products(){
  return <Link className={styles.link} href="/dashboard/products">Products</Link>
}
