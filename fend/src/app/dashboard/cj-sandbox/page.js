"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, Box, Button, Card, CardContent, CardHeader, Chip, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";

const CJ_STATUS_ACTIONS = [
  { targetStatus: 400, label: "CJ: processing" },
  { targetStatus: 500, label: "CJ: shipped" },
  { targetStatus: 600, label: "CJ: delivered" },
  { targetStatus: 700, label: "Close sandbox order", danger: true },
];
const STOREFRONT_STAGES = ["Packed", "Shipped", "In Transit", "Out for Delivery", "Delivered"];
const subscribeToHydration = () => () => {};
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

function cjSandboxStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function cjDashboardStatus(value, storefrontStatus) {
  const status = cjSandboxStatus(value || storefrontStatus);
  if (["DELIVERED", "COMPLETED", "FULFILLED"].includes(status)) return "Completed";
  if (status === "PROCESSING") return "Processing";
  if (status === "SHIPPED") return "Shipped";
  if (status === "IN_TRANSIT") return "In transit";
  if (status === "OUT_FOR_DELIVERY") return "Out for delivery";
  if (status === "CANCELLED" || status === "CANCELED") return "Cancelled";
  return String(value || storefrontStatus || "Not submitted");
}

function displayDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "?" : date.toLocaleString();
}

export default function CjSandboxPage() {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientHydrationState, getServerHydrationState);
  const [enabled, setEnabled] = useState(false);
  const [autoSubmitReady, setAutoSubmitReady] = useState(false);
  const [configurationIssues, setConfigurationIssues] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(() => orders.find((order) => order.orderId === selectedId) || null, [orders, selectedId]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cj/sandbox/orders", { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      setEnabled(Boolean(data.enabled));
      setAutoSubmitReady(Boolean(data.autoSubmitReady));
      setConfigurationIssues(Array.isArray(data.issues) ? data.issues : []);
      if (!response.ok) throw new Error(data.error || "Unable to load sandbox orders");
      const nextOrders = Array.isArray(data.orders) ? data.orders : [];
      setOrders(nextOrders);
      setSelectedId((current) => nextOrders.some((order) => order.orderId === current) ? current : (nextOrders[0]?.orderId || ""));
    } catch (requestError) {
      setOrders([]);
      setError(requestError.message || "Unable to load sandbox orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  async function runAction(path, body = {}) {
    if (!selected || working) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/cj/sandbox/orders/${encodeURIComponent(selected.orderId)}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Sandbox action failed");
      setMessage(path === "/submit" ? "Paid order submitted to the sandbox." : "Sandbox action completed. Order state refreshed.");
      await refresh();
    } catch (requestError) {
      const errorMessage = requestError.message || "Sandbox action failed";
      await refresh();
      setError(errorMessage);
    } finally {
      setWorking(false);
    }
  }

  // Keep native form attributes out of the initial SSR markup. The sandbox
  // data is loaded only in the browser, so rendering these values before
  // hydration can otherwise leave React and the existing DOM out of sync.
  const refreshDisabled = hydrated && (loading || working);
  const unavailable = hydrated && (loading || working || !selected?.cjOrderId || !enabled);
  const submitUnavailable = hydrated && (loading || working || !selected || Boolean(selected?.cjOrderId) || selected?.requiresShippingSelection || !autoSubmitReady);
  const sandboxStatus = cjSandboxStatus(selected?.cjStatus);
  const paymentNeeded = !sandboxStatus || ["CREATED", "IN_CART", "UNPAID"].includes(sandboxStatus);
  const paidSandboxOrder = ["PENDING", "PROCESSING", "UNSHIPPED", "SHIPPED", "DELIVERED"].includes(sandboxStatus);
  const statusActionAllowed = (targetStatus) => (
    (targetStatus === 400 && ["PENDING", "UNSHIPPED"].includes(sandboxStatus))
    || (targetStatus === 500 && sandboxStatus === "PROCESSING")
    || (targetStatus === 600 && sandboxStatus === "SHIPPED")
    || (targetStatus === 700 && sandboxStatus === "DELIVERED")
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: "100vh", background: "#f8fafc" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>CJ sandbox test panel</Typography>
          <Typography variant="body2" color="text.secondary">Admin-only controls for test orders. These controls cannot run unless CJ sandbox mode is enabled.</Typography>
        </Box>
        <Button variant="outlined" onClick={refresh} disabled={refreshDisabled} data-button-loading-managed="true">Refresh orders</Button>
      </Stack>

      <Alert severity="warning" sx={{ mb: 3 }}>
        Sandbox actions never create a real shipment or charge CJ balance. CJ requires its own status sequence; storefront previews are local test-only timeline updates.
      </Alert>
      {!loading && configurationIssues.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography component="div" sx={{ fontWeight: 800, mb: 0.5 }}>Sandbox order submission is not ready.</Typography>
          {configurationIssues.map((issue) => <Typography component="div" variant="body2" key={issue}>• {issue}</Typography>)}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

      <Card>
        <CardHeader title="Select a CJ sandbox order" subheader="Only an order that CJ confirms as sandbox can be changed." />
        <Divider />
        <CardContent>
          <TextField select fullWidth label="Paid storefront order" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={hydrated && (loading || orders.length === 0)}>
            {orders.map((order) => <MenuItem key={order.orderId} value={order.orderId}>{order.orderId} · {order.submissionStatus} · {cjDashboardStatus(order.cjStatus, order.storefrontStatus)}</MenuItem>)}
          </TextField>
          {!loading && orders.length === 0 && <Typography sx={{ mt: 2 }} color="text.secondary">No paid storefront orders were found.</Typography>}

          {selected && (
            <Stack spacing={2} sx={{ mt: 3 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Storefront: ${selected.storefrontStatus}`} color="primary" />
                <Chip label={`Payment: ${selected.paymentStatus}`} color="success" variant="outlined" />
                <Chip label={`Submission: ${selected.submissionStatus}`} color={selected.cjOrderId ? "success" : "warning"} variant="outlined" />
                <Chip label={`Shipping: ${selected.shippingService || "not selected"}`} color={selected.shippingService ? "default" : "warning"} variant="outlined" />
                <Chip label={`CJ: ${cjDashboardStatus(selected.cjStatus, selected.storefrontStatus)}`} variant="outlined" />
                <Chip label={`Tracking: ${selected.trackingNumber || "not set"}`} variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary">Created {displayDate(selected.placedAt)} · Last CJ sync {displayDate(selected.lastSyncedAt)}</Typography>

              {!selected.cjOrderId && (
                <Alert
                  severity={selected.lastError ? "error" : "info"}
                  action={<Button color="inherit" size="small" onClick={() => runAction("/submit")} disabled={submitUnavailable}>Submit to sandbox</Button>}
                >
                  {selected.requiresShippingSelection
                    ? "This older order has no selected live shipping service. Create a new sandbox checkout after choosing a shipping option."
                    : selected.lastError || "This paid order has not been submitted to the supplier sandbox yet."}
                </Alert>
              )}

              {selected.cjOrderId && <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>1. CJ sandbox simulation</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="contained" onClick={() => runAction("/simulate-payment")} disabled={unavailable || !paymentNeeded} data-button-loading-managed="true">Simulate CJ payment</Button>
                  {CJ_STATUS_ACTIONS.map((action) => <Button key={action.targetStatus} color={action.danger ? "error" : "primary"} variant="outlined" data-button-loading-managed="true" onClick={() => {
                    if (action.danger && !window.confirm("Close this sandbox order? This cannot be reversed in CJ.")) return;
                    runAction("/status", { targetStatus: action.targetStatus });
                  }} disabled={unavailable || !statusActionAllowed(action.targetStatus)}>{action.label}</Button>)}
                </Stack>
              </Box>}

              {selected.cjOrderId && <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>2. Fake tracking number</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField label="Sandbox tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="SBX-TRACK-001" inputProps={{ maxLength: 64 }} disabled={unavailable || !paidSandboxOrder} fullWidth />
                  <Button variant="outlined" disabled={unavailable || !paidSandboxOrder || !trackingNumber.trim()} data-button-loading-managed="true" onClick={() => runAction("/tracking-number", { trackingNumber: trackingNumber.trim() })}>Save tracking</Button>
                </Stack>
              </Box>}

              {selected.cjOrderId && <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>3. Storefront delivery-stage preview</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Use these local sandbox previews to verify the exact customer tracking UI stages. They do not call a real carrier.</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {STOREFRONT_STAGES.map((stage) => <Button key={stage} variant="outlined" onClick={() => runAction("/stage-preview", { stage })} disabled={unavailable} data-button-loading-managed="true">{stage}</Button>)}
                </Stack>
              </Box>}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
