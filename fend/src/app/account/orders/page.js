"use client";

import { useEffect, useState } from "react";
import { fetchOrders, fetchSession } from "../../lib/apiClient";
import { AccountPageSkeleton } from "../../components/LoadingSkeletons";
import styles from "../account.module.css";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const session = await fetchSession();
      if (!session) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      const ord = await fetchOrders();
      setOrders(ord.orders || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <AccountPageSkeleton variant="orders" />;
  if (!authed) return <div className={styles.heroTitle}>Sign in to view your orders.</div>;

  return (
    <div>
      <div className={styles.hero}>
        <div>
          <div className={styles.heroTitle}>Orders</div>
          <div className={styles.heroSub}>Recent purchases and their status.</div>
        </div>
      </div>

      <section className={styles.panel} id="orders">
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
                <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>
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
