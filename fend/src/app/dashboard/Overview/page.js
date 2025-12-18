"use client"

import styles from './overview.module.css'

const cardData = [
  { title: 'Total Visits', value: '45,124', badge: '+3.6% vs last week', gradient: 'linear-gradient(135deg, #4c6fff, #5ac8fa)' },
  { title: 'Avg Time', value: '02:15', badge: '+1.2% vs last week', gradient: 'linear-gradient(135deg, #ff6b9d, #ff8f70)' },
  { title: 'Total Orders', value: '871', badge: '+4.8% vs last week', gradient: 'linear-gradient(135deg, #1ec9a6, #1da7ff)' },
  { title: 'Total Sales', value: '$48,630', badge: '+6.4% vs last week', gradient: 'linear-gradient(135deg, #f97316, #facc15)' }
]

const monthly = [
  { label: 'Jan', value: 62 },
  { label: 'Feb', value: 68 },
  { label: 'Mar', value: 70 },
  { label: 'Apr', value: 66 },
  { label: 'May', value: 75 },
  { label: 'Jun', value: 72 },
  { label: 'Jul', value: 78 },
  { label: 'Aug', value: 69 }
]

const segments = [
  { label: 'Email subscriptions', value: '$4,500', color: '#60a5fa' },
  { label: 'Registered users', value: '$3,200', color: '#22c55e' },
  { label: 'Admin', value: '$1,980', color: '#f97316' },
  { label: 'Guests', value: '$1,440', color: '#a855f7' },
  { label: 'Members', value: '$920', color: '#0ea5e9' },
  { label: 'Orders', value: '$830', color: '#ef4444' }
]

export default function Overview() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Hi, welcome back!</div>
          <div className={styles.subtitle}>Here is a fast snapshot of your store performance.</div>
        </div>
      </header>

      <section className={styles.grid}>
        {cardData.map((card) => (
          <article
            key={card.title}
            className={styles.card}
            style={{ background: card.gradient }}
          >
            <div className={styles.wave} />
            <h3>{card.title}</h3>
            <div className={styles.valueRow}>
              <span className={styles.value}>{card.value}</span>
              <span className={styles.badge}>{card.badge}</span>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Monthly Visits</div>
            <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>Last 8 months</span>
          </div>
          <div>
            <div className={styles.chart}>
              {monthly.map((item) => (
                <div key={item.label} style={{ flex: 1 }}>
                  <div
                    className={styles.bar}
                    style={{ height: `${item.value}%` }}
                  >
                    <span className={styles.barValue}>{item.value}k</span>
                  </div>
                  <div className={styles.barLabel}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Sales Overview</div>
            <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>Today</span>
          </div>
          <ul className={styles.legendList}>
            {segments.map((seg) => (
              <li key={seg.label} className={styles.legendItem}>
                <div className={styles.legendLeft}>
                  <span className={styles.dot} style={{ background: seg.color }} />
                  <span>{seg.label}</span>
                </div>
                <strong style={{ color: '#0f172a' }}>{seg.value}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.footerGrid}>
        <div className={styles.miniCard}>
          <div className={styles.miniTitle}>Visitors by platform</div>
          <div className={styles.miniValue}>62.4k</div>
          <div className={styles.subtitle}>Web · iOS · Android split</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniTitle}>Conversion rate</div>
          <div className={styles.miniValue}>4.2%</div>
          <div className={styles.subtitle}>Up 0.5% vs last week</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.miniTitle}>Tickets resolved</div>
          <div className={styles.miniValue}>1,248</div>
          <div className={styles.subtitle}>Support desk in the past 30 days</div>
        </div>
      </section>
    </div>
  )
}
