"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchOrderById, fetchOrders, fetchSession } from "../../lib/apiClient";
import { hideSupplierBranding } from "../../lib/customerFacingText";
import { AccountPageSkeleton } from "../../components/LoadingSkeletons";
import styles from "./tracking.module.css";

const STEPS = ["Order confirmed", "Packed", "Shipped", "In transit", "Out for delivery", "Delivered"];

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
}

function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", ...options });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getStepIndex(tracking, order) {
  if (Number.isFinite(Number(tracking?.progressIndex))) return Number(tracking.progressIndex);
  const status = String(order?.status || "processing").toLowerCase();
  if (status.includes("out for")) return 4;
  if (status.includes("deliver")) return 5;
  if (status.includes("transit")) return 3;
  if (status.includes("ship")) return 2;
  if (status.includes("pack")) return 1;
  return 0;
}

export default function AccountTrackingPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchSession(), fetchOrders()])
      .then(([sessionData, orderData]) => {
        if (!active) return;
        setSession(sessionData?.user || null);
        setRecentOrders(Array.isArray(orderData?.orders) ? orderData.orders.slice(0, 3) : []);
      })
      .catch(() => {
        if (active) setError("We could not load your account orders. Please try again.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // Keep the visible journey current while the customer leaves the tracking
  // page open. The backend refreshes the CJ order/tracking status and applies
  // the next monotonic storefront stage on each lookup.
  useEffect(() => {
    if (!order?.id) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const result = await fetchOrderById(order.id);
        if (active && result?.order) setOrder(result.order);
      } catch (_error) {
        // Keep the last known status visible during a temporary provider error.
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [order?.id]);

  const progressIndex = useMemo(() => getStepIndex(order?.tracking, order), [order]);

  const handleLookup = async (event) => {
    event.preventDefault();
    const value = orderId.trim();
    setError("");
    setOrder(null);
    if (!session) {
      setError("Sign in to securely view orders connected to your account.");
      return;
    }
    if (!value) {
      setError("Enter an order number to continue.");
      return;
    }
    try {
      setLookupLoading(true);
      const result = await fetchOrderById(value);
      setOrder(result.order || null);
      if (!result.order) setError("We could not find that order in your account.");
    } catch (lookupError) {
      setError(lookupError.message === "unauthorized" ? "Your session has expired. Please sign in again." : lookupError.message || "We could not find that order.");
    } finally {
      setLookupLoading(false);
    }
  };

  const selectRecentOrder = (value) => {
    setOrderId(String(value || ""));
    setError("");
  };

  if (loading) {
    return <AccountPageSkeleton variant="orders" />;
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>ORDER VISIBILITY · 2026</div>
          <h1>Every delivery,<br /><span>beautifully in view.</span></h1>
          <p>Follow your Weluxo order from confirmation to doorstep with one calm, precise view.</p>
          <div className={styles.heroMeta}><span>Private to your account</span><span>Live delivery updates</span></div>
        </div>
        <div className={styles.heroMark} aria-hidden="true"><span>WLX</span><small>MOVE WITH INTENT</small></div>
      </section>

      <section className={styles.lookupCard} aria-labelledby="lookup-title">
        <div>
          <div className={styles.sectionKicker}>TRACK AN ORDER</div>
          <h2 id="lookup-title">Where is your order now?</h2>
          <p>Use the order number from your confirmation email or account history.</p>
        </div>
        <form className={styles.lookupForm} onSubmit={handleLookup}>
          <label htmlFor="order-number">Order number</label>
          <div className={styles.inputRow}>
            <input id="order-number" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="WLX-20260810-12345" autoComplete="off" />
            <button type="submit" disabled={lookupLoading}>{lookupLoading ? "Checking…" : "Track order"}</button>
          </div>
        </form>
        {recentOrders.length > 0 && (
          <div className={styles.recentOrders}>
            <span>Recent orders</span>
            {recentOrders.map((recent) => <button type="button" key={recent.id} onClick={() => selectRecentOrder(recent.id)}>#{recent.id}</button>)}
          </div>
        )}
        {error && <div className={styles.error} role="alert">{error}</div>}
      </section>

      {!session && (
        <section className={styles.signInCard}>
          <div><strong>Sign in for your private delivery view.</strong><span>Your order history and shipment details stay connected to your account.</span></div>
          <Link href="/signin">Sign in</Link>
        </section>
      )}

      {order && (
        <section className={styles.resultStack} aria-live="polite">
          <div className={styles.orderHeader}>
            <div><div className={styles.sectionKicker}>ORDER FOUND</div><h2>#{order.id}</h2><p>Placed {formatDateTime(order.placedAt)}</p></div>
            <div className={styles.statusBadge}>{order.status || "Processing"}</div>
          </div>

          <div className={styles.summaryGrid}>
            <div><span>Estimated arrival</span><strong>{formatDate(order.tracking?.estimatedDelivery)}</strong><small>Based on your delivery method</small></div>
            <div><span>Carrier</span><strong>{hideSupplierBranding(order.tracking?.carrier, "Assigned at dispatch")}</strong><small>{order.tracking?.trackingNumber ? `Tracking ${order.tracking.trackingNumber}` : "Tracking number appears after dispatch"}</small></div>
            <div><span>Delivering to</span><strong>{order.shippingAddress?.city || "Your address"}</strong><small>{order.shippingAddress?.country || "Destination confirmed at checkout"}</small></div>
          </div>

          <div className={styles.contentGrid}>
            <div className={styles.progressCard}>
              <div className={styles.cardHeader}><div><div className={styles.sectionKicker}>DELIVERY JOURNEY</div><h3>Your order is moving</h3></div><span>{Math.round(((progressIndex + 1) / STEPS.length) * 100)}%</span></div>
              <div className={styles.stepper}>
                {STEPS.map((step, index) => <div className={`${styles.step} ${index < progressIndex ? styles.complete : ""} ${index === progressIndex ? styles.current : ""}`} key={step}><div className={styles.stepDot}>{index < progressIndex ? "✓" : String(index + 1).padStart(2, "0")}</div><div><strong>{step}</strong><small>{index === progressIndex ? "Current stage" : index < progressIndex ? "Complete" : "Up next"}</small></div></div>)}
              </div>
              <div className={styles.progressTrack}><span style={{ width: `${Math.max(8, (progressIndex / (STEPS.length - 1)) * 100)}%` }} /></div>
            </div>

            <div className={styles.detailsCard}>
              <div className={styles.cardHeader}><div><div className={styles.sectionKicker}>ORDER DETAILS</div><h3>Your pieces</h3></div><strong>{formatMoney(order.total)}</strong></div>
              <div className={styles.items}>{order.items?.length ? order.items.map((item, index) => <div className={styles.item} key={`${order.id}-${index}`}><div className={styles.itemThumb}>{String(item.title || "W").slice(0, 1).toUpperCase()}</div><div><strong>{item.title || "Weluxo item"}</strong><span>Qty {item.quantity || 1}</span></div><b>{formatMoney(item.price)}</b></div>) : <p className={styles.muted}>Your order items will appear here.</p>}</div>
            </div>
          </div>

          <div className={styles.timelineCard}>
            <div className={styles.cardHeader}><div><div className={styles.sectionKicker}>LIVE UPDATES</div><h3>Delivery timeline</h3></div><span className={styles.location}>{order.tracking?.currentLocation || "Order processing"}</span></div>
            <div className={styles.timeline}>{(order.tracking?.events || []).map((event, index) => <div className={`${styles.timelineEvent} ${index === 0 ? styles.timelineLatest : ""}`} key={`${event.eventAt || event.createdAt}-${index}`}><div className={styles.timelineRail}><span /></div><div><strong>{hideSupplierBranding(event.title || event.status, "Order update")}</strong><p>{hideSupplierBranding(event.description, "Your order has been updated.")}</p><small>{formatDateTime(event.eventAt || event.createdAt)}{event.location ? ` · ${event.location}` : ""}</small></div></div>)}</div>
          </div>
        </section>
      )}

      {!order && !error && <div className={styles.emptyState}><span>01</span><div><strong>Enter an order number to see the full journey.</strong><p>Need help? Visit <Link href="/account/support">Support</Link>.</p></div></div>}
    </div>
  );
}
