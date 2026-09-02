"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchOrders, fetchProfile, fetchSavedProducts, fetchSession, logoutRequest } from "../lib/apiClient";
import { AccountPageSkeleton } from "../components/LoadingSkeletons";
import styles from "./account.module.css";

function displayName(profile, user) {
  return profile?.name || profile?.username || user?.name || user?.username || "there";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function statusClass(status) {
  const normalized = String(status || "processing").toLowerCase();
  if (normalized.includes("deliver")) return styles.statusDelivered;
  if (normalized.includes("cancel")) return styles.statusCancelled;
  if (normalized.includes("ship")) return styles.statusShipped;
  return styles.statusProcessing;
}

function productCount(order) {
  return Array.isArray(order?.items)
    ? order.items.reduce((total, item) => total + (Number(item.quantity) || 1), 0)
    : 0;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const session = await fetchSession();
        if (!session) return;

        if (active) {
          setUser(session.user);
          setProfile(session.user);
        }

        const [prof, ord, saved] = await Promise.all([
          fetchProfile(),
          fetchOrders(),
          fetchSavedProducts().catch(() => ({ items: [] })),
        ]);

        if (!active) return;
        setUser(session.user);
        setProfile(prof || session.user);
        setOrders(Array.isArray(ord?.orders) ? ord.orders : []);
        setSavedProducts(Array.isArray(saved?.items) ? saved.items : []);
      } catch (_loadError) {
        if (active) setError("We couldn't load your account right now. Please refresh and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await logoutRequest();
    window.dispatchEvent(new CustomEvent("weluxo:session-updated", { detail: null }));
    router.push("/signin");
  }

  if (loading) {
    return <AccountPageSkeleton />;
  }

  if (!user) {
    return (
      <section className={styles.stateCard}>
        <div className={styles.stateIcon} aria-hidden="true">↗</div>
        <div>
          <p className={styles.eyebrow}>CUSTOMER ACCOUNT</p>
          <h2>Sign in to view your account</h2>
          <p>Access your orders, saved products, and account details in one place.</p>
        </div>
        <Link className={styles.primaryBtn} href="/signin">Sign in</Link>
      </section>
    );
  }

  const name = displayName(profile, user);
  const firstName = name.split(" ")[0];
  const recentOrders = orders.slice(0, 4);

  return (
    <div className={styles.overviewPage}>
      {error && <div className={styles.savedError} role="alert">{error}</div>}

      <section className={styles.welcomePanel}>
        <div>
          <p className={styles.eyebrow}>ACCOUNT OVERVIEW</p>
          <h2>Welcome back, {firstName}</h2>
          <p>Manage your orders, saved products, and personal details.</p>
        </div>
        <div className={styles.welcomeActions}>
          <Link className={styles.primaryBtn} href="/shop">Continue shopping</Link>
          <button className={styles.ghostBtn} type="button" onClick={handleLogout}>Sign out</button>
        </div>
      </section>

      <section className={styles.quickLinks} aria-label="Account shortcuts">
        <Link className={styles.quickLink} href="/account/orders">
          <span className={styles.quickIcon} aria-hidden="true">01</span>
          <span><strong>Orders</strong><small>{orders.length ? `${orders.length} total` : "No orders yet"}</small></span>
          <span className={styles.quickArrow} aria-hidden="true">→</span>
        </Link>
        <Link className={styles.quickLink} href="/account/saved">
          <span className={styles.quickIcon} aria-hidden="true">02</span>
          <span><strong>Saved products</strong><small>{savedProducts.length ? `${savedProducts.length} saved` : "Save for later"}</small></span>
          <span className={styles.quickArrow} aria-hidden="true">→</span>
        </Link>
        <Link className={styles.quickLink} href="/account/profile">
          <span className={styles.quickIcon} aria-hidden="true">03</span>
          <span><strong>Profile details</strong><small>View your information</small></span>
          <span className={styles.quickArrow} aria-hidden="true">→</span>
        </Link>
      </section>

      <section className={styles.panel} aria-labelledby="recent-orders-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>ORDER HISTORY</p>
            <h2 id="recent-orders-title">Recent orders</h2>
          </div>
          <Link className={styles.textLink} href="/account/orders">View all orders <span aria-hidden="true">→</span></Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <div>
              <h3>Your order history is empty</h3>
              <p>When you place an order, you’ll find the details and delivery status here.</p>
            </div>
            <Link className={styles.secondaryBtn} href="/shop">Browse products</Link>
          </div>
        ) : (
          <div className={styles.orderList}>
            <div className={`${styles.orderRow} ${styles.orderRowHeader}`} aria-hidden="true">
              <span>Order</span><span>Date</span><span>Status</span><span>Total</span><span />
            </div>
            {recentOrders.map((order) => (
              <div className={styles.orderRow} key={order.id}>
                <div className={styles.orderCell}>
                  <span className={styles.mobileCellLabel}>Order</span>
                  <strong>#{order.id}</strong>
                  <small>{productCount(order)} {productCount(order) === 1 ? "item" : "items"}</small>
                </div>
                <div className={styles.orderCell}>
                  <span className={styles.mobileCellLabel}>Date</span>
                  <span>{formatDate(order.placedAt)}</span>
                </div>
                <div className={styles.orderCell}>
                  <span className={styles.mobileCellLabel}>Status</span>
                  <span className={`${styles.statusPill} ${statusClass(order.status)}`}>{order.status || "Processing"}</span>
                </div>
                <div className={styles.orderCell}>
                  <span className={styles.mobileCellLabel}>Total</span>
                  <strong>{formatMoney(order.total)}</strong>
                </div>
                <div className={styles.orderAction}>
                  <Link className={styles.textLink} href={`/invoice/${encodeURIComponent(order.id)}`}>View order <span aria-hidden="true">→</span></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.infoGrid}>
        <article className={styles.infoCard}>
          <div className={styles.sectionHeaderCompact}>
            <div>
              <p className={styles.eyebrow}>ACCOUNT DETAILS</p>
              <h2>Contact information</h2>
            </div>
            <Link className={styles.textLink} href="/account/settings">Edit</Link>
          </div>
          <dl className={styles.detailList}>
            <div><dt>Name</dt><dd>{profile?.name || profile?.username || "Member"}</dd></div>
            <div><dt>Email</dt><dd>{profile?.email || user?.email || "—"}</dd></div>
            <div><dt>Member since</dt><dd>{formatDate(profile?.createdAt)}</dd></div>
          </dl>
        </article>
        <article className={`${styles.infoCard} ${styles.helpCard}`}>
          <p className={styles.eyebrow}>NEED A HAND?</p>
          <h2>We’re here to help.</h2>
          <p>Find answers, contact support, or check the delivery status of an order.</p>
          <div className={styles.helpLinks}>
            <Link className={styles.textLink} href="/account/support">Contact support <span aria-hidden="true">→</span></Link>
            <Link className={styles.textLink} href="/account/tracking">Track an order <span aria-hidden="true">→</span></Link>
          </div>
        </article>
      </section>
    </div>
  );
}
