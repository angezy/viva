"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchSession, fetchProfile, fetchOrders, logoutRequest } from "../lib/apiClient";
import styles from "./account.module.css";

const cardGradients = [
  "linear-gradient(135deg, #4c6fff, #5ac8fa)",
  "linear-gradient(135deg, #ff6b9d, #ff8f70)",
  "linear-gradient(135deg, #1ec9a6, #1da7ff)",
  "linear-gradient(135deg, #f97316, #facc15)",
];

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const session = await fetchSession();
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(session.user);
      const [prof, ord] = await Promise.all([fetchProfile(), fetchOrders()]);
      setProfile(prof || session.user);
      setOrders(ord.orders || []);
      setLoading(false);
    }
    load();
  }, []);

  const totals = useMemo(() => {
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const delivered = orders.filter((o) => o.status === "Delivered").length;
    const pending = orders.length - delivered;
    return { totalSpent, delivered, pending };
  }, [orders]);

  const monthlyBars = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
    if (!orders.length) {
      return months.map((m) => ({ label: m, value: Math.round(Math.random() * 120 + 40) }));
    }
    return months.map((m, idx) => {
      const sample = orders[idx % orders.length];
      const val = sample?.total || Math.random() * 120 + 40;
      return { label: m, value: Math.round(val) };
    });
  }, [orders]);

  const handleLogout = async () => {
    await logoutRequest();
    location.href = "/signin";
  };

  if (loading) {
    return (
      <div>
        <div className={styles.hero}>
          <div>
            <div className={styles.heroTitle}>Loading your account...</div>
            <div className={styles.heroSub}>Please wait a moment.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <div className={styles.hero}>
          <div>
            <div className={styles.heroTitle}>Member sign in</div>
            <div className={styles.heroSub}>Access your profile, order history, and saved cart.</div>
          </div>
          <button className={styles.primaryBtn} onClick={() => (location.href = "/signin")}>Go to sign in</button>
        </div>
      </div>
    );
  }

  const cardData = [
    { title: "Orders placed", value: orders.length || 0, badge: "History" },
    { title: "Delivered", value: totals.delivered, badge: "Completed" },
    { title: "Pending / processing", value: totals.pending, badge: "In progress" },
    { title: "Total spent", value: `$${totals.totalSpent.toFixed(2)}`, badge: "All time" },
  ];

  const segments = [
    { label: "Registered user", value: profile?.role || "user", color: "#60a5fa" },
    { label: "Email", value: profile?.email || "-", color: "#22c55e" },
    { label: "Last login", value: profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "n/a", color: "#f97316" },
    { label: "Member since", value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "n/a", color: "#a855f7" },
  ];

  return (
    <div>
      <div className={styles.hero}>
        <div>
          <div className={styles.heroTitle}>Hi, welcome back!</div>
          <div className={styles.heroSub}>Your personal dashboard and order overview.</div>
        </div>
        <div className={styles.linkRow}>
          <button className={styles.primaryBtn} onClick={handleLogout}>Sign out</button>
          <button className={styles.ghostBtn} onClick={() => (location.href = "/shop")}>Shop</button>
        </div>
      </div>

      <section className={styles.grid}>
        {cardData.map((card, idx) => (
          <article
            key={card.title}
            className={styles.card}
            style={{ background: cardGradients[idx % cardGradients.length] }}
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
        <article className={styles.panel} id="profile">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Spending by month</div>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>Recent activity</span>
          </div>
          <div className={styles.chart}>
            {monthlyBars.map((item) => (
              <div key={item.label} style={{ flex: 1 }}>
                <div
                  className={styles.bar}
                  style={{ height: `${Math.min(100, item.value / 2)}%` }}
                >
                  <span className={styles.barValue}>${item.value}</span>
                </div>
                <div className={styles.barLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel} id="orders">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Account overview</div>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>Profile</span>
          </div>
          <ul className={styles.legendList}>
            {segments.map((seg) => (
              <li key={seg.label} className={styles.legendItem}>
                <div className={styles.legendLeft}>
                  <span className={styles.dot} style={{ background: seg.color }} />
                  <span>{seg.label}</span>
                </div>
                <strong style={{ color: "#0f172a" }}>{seg.value}</strong>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.panel} style={{ marginTop: 14 }}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>Recent orders</div>
          <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>{orders.length} total</span>
        </div>
        {orders.length === 0 ? (
          <div style={{ color: "#475569" }}>No orders yet. Your purchases will appear here.</div>
        ) : (
          <div className={styles.orders}>
            {orders.map((order) => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <strong>#{order.id}</strong>
                  <span className={styles.pill} style={{ background: order.status === "Delivered" ? "#dcfce7" : "#fef9c3" }}>
                    {order.status}
                  </span>
                </div>
                <div style={{ color: "#475569", marginBottom: 6 }}>
                  Placed: {order.placedAt ? new Date(order.placedAt).toLocaleString() : "-"}
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
                  Total: ${order.total?.toFixed ? order.total.toFixed(2) : order.total}
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  {order.items?.map((item, idx) => (
                    <div key={`${order.id}-${idx}`}>
                      {item.quantity} x {item.title} – ${item.price}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
