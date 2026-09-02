import React from 'react';
import Link from 'next/link';
import styles from './link.module.css';

export default function LinkSeven() {
  return <Link className={styles.link} href="/dashboard/integrations">Integrations</Link>;
}
