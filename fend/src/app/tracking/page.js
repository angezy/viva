"use client";

import { useState } from "react";
import { fetchOrderById, fetchSession } from "../lib/apiClient";

export default function TrackingPage() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(true);

  const handleLookup = async (e) => {
    e.preventDefault();
    setError("");
    setOrder(null);
    if (!orderId.trim()) {
      setError("Enter an order id");
      return;
    }
    try {
      setLoading(true);
      const session = await fetchSession();
      if (!session) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);
      const data = await fetchOrderById(orderId.trim());
      setOrder(data.order);
    } catch (err) {
      setError(err.message || "Unable to find order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 28, color: "#0f172a", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Track your order</div>
        <div style={{ color: "#475569", marginTop: 4 }}>Enter an order ID from your account.</div>
      </div>

      <form onSubmit={handleLookup} style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="e.g. ord-12345"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            minWidth: 240,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "none",
            background: "#0b6c3a",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            minWidth: 120,
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? "Checking..." : "Track"}
        </button>
      </form>

      {!authed && (
        <div style={{ color: "#b91c1c", marginBottom: 10 }}>Please sign in to view your orders.</div>
      )}
      {error && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{error}</div>}

      {order && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
            maxWidth: 520,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Order #{order.id}</div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: order.status === "Delivered" ? "#dcfce7" : "#fef9c3",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {order.status}
            </div>
          </div>
          <div style={{ color: "#475569", marginBottom: 6 }}>
            Placed: {order.placedAt ? new Date(order.placedAt).toLocaleString() : "-"}
          </div>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
            Total: ${order.total?.toFixed ? order.total.toFixed(2) : order.total}
          </div>
          <div style={{ color: "#475569", fontSize: 13, marginBottom: 10 }}>Items:</div>
          <div style={{ color: "#0f172a", fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
            {order.items?.map((item, idx) => (
              <div key={`${order.id}-${idx}`}>
                {item.quantity} x {item.title} – ${item.price}
              </div>
            )) || <div>No items</div>}
          </div>
        </div>
      )}
    </div>
  );
}
