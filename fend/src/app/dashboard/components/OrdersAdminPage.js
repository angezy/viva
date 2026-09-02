"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import styles from "./ordersAdmin.module.css";
import { TablePageSkeleton } from "../../components/LoadingSkeletons";

const DEFAULT_FILTERS = {
  range: "last30",
  from: "",
  to: "",
  currency: "",
  status: "",
  paymentStatus: "",
  fulfillmentStatus: "",
};

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 days"],
  ["last30", "Last 30 days"],
  ["thismonth", "This month"],
  ["lastmonth", "Last month"],
  ["thisyear", "This year"],
  ["custom", "Custom range"],
];

function label(value) {
  if (value == null || value === "") return "—";
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function value(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function dateValue(input, withTime = false) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return value(input);
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function money(amount, currency = "USD") {
  const code = /^[A-Za-z]{3}$/.test(String(currency || "")) ? String(currency).toUpperCase() : "USD";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(Number(amount || 0));
}

function number(amount) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(amount || 0));
}

function tone(status) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "completed", "delivered", "shipped", "authorized"].includes(normalized)) return "success";
  if (["processing", "in transit", "partially refunded"].includes(normalized)) return "info";
  if (["pending", "unfulfilled", "open", "draft"].includes(normalized)) return "warning";
  if (["cancelled", "canceled", "failed", "refunded", "blocked"].includes(normalized)) return "danger";
  return "neutral";
}

function StatusPill({ status }) {
  return <span className={`${styles.status} ${styles[tone(status)]}`}>{label(status)}</span>;
}

function StatCard({ icon: Icon, label: statLabel, value: statValue, detail, tone: cardTone = "blue" }) {
  return (
    <article className={`${styles.statCard} ${styles[`stat${cardTone}`]}`}>
      <span className={styles.statIcon}><Icon fontSize="small" /></span>
      <div className={styles.statCopy}>
        <span>{statLabel}</span>
        <strong>{statValue}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function DetailSection({ title, eyebrow, children, className = "" }) {
  return (
    <section className={`${styles.detailSection} ${className}`}>
      <div className={styles.detailSectionHeading}>
        <div>
          {eyebrow && <span className={styles.detailEyebrow}>{eyebrow}</span>}
          <h3>{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function DetailValue({ label: detailLabel, children, wide = false }) {
  return <div className={`${styles.detailValue} ${wide ? styles.wide : ""}`}><span>{detailLabel}</span><strong>{children}</strong></div>;
}

function AddressCard({ address, title }) {
  if (!address) {
    return <div className={styles.emptyInline}>{title} address was not captured for this order.</div>;
  }

  const fullName = [address.FirstName, address.LastName].filter(Boolean).join(" ");
  const lines = [
    fullName,
    address.Company,
    address.AddressLine1,
    address.AddressLine2,
    [address.City, address.StateProvince, address.PostalCode].filter(Boolean).join(", "),
    address.CountryCode,
  ].filter(Boolean);

  return (
    <div className={styles.addressCard}>
      <div className={styles.addressCardTop}><span>{title}</span>{address.Phone && <small>{address.Phone}</small>}</div>
      <address>{lines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</address>
    </div>
  );
}

function EmptyRows({ children = "No records captured." }) {
  return <div className={styles.emptyInline}>{children}</div>;
}

function DetailModal({ selected, detail, loading, error, onClose, onRetry }) {
  useEffect(() => {
    if (!selected) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, selected]);

  if (!selected) return null;

  const order = detail?.order || selected;
  const items = detail?.items || [];
  const addresses = detail?.addresses || [];
  const shippingAddress = addresses.find((address) => String(address.AddressType).toLowerCase() === "shipping");
  const billingAddress = addresses.find((address) => String(address.AddressType).toLowerCase() === "billing");
  const currency = order.Currency || selected.Currency || "USD";
  const customerName = order.FullName || [order.FirstName, order.LastName].filter(Boolean).join(" ");

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
        <header className={styles.modalHeader}>
          <div className={styles.modalHeading}>
            <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close order details"><CloseRoundedIcon /></button>
            <div>
              <span className={styles.detailEyebrow}>ORDER DETAIL</span>
              <h2 id="order-detail-title">{value(order.OrderNumber || selected.OrderNumber)}</h2>
              <p>Placed {dateValue(order.PlacedAt || order.CreatedAt || selected.CreatedAt, true)}</p>
            </div>
          </div>
          <div className={styles.modalActions}>
            <StatusPill status={order.OrderStatus || selected.OrderStatus} />
            <button className={styles.closeButton} type="button" onClick={onClose}>Close</button>
          </div>
        </header>

        <div className={styles.modalScroll} onMouseDown={(event) => event.stopPropagation()}>
          {loading && <div className={styles.detailLoading}><span className={styles.spinner} /> Loading full order details…</div>}
          {error && <div className={styles.detailError}><strong>Couldn’t load this order.</strong><span>{error}</span><button type="button" onClick={onRetry}>Try again</button></div>}

          {!loading && !error && detail && <>
            <div className={styles.statusStrip}>
              <div><span>Order status</span><StatusPill status={order.OrderStatus} /></div>
              <div><span>Payment</span><StatusPill status={order.PaymentStatus} /></div>
              <div><span>Fulfillment</span><StatusPill status={order.FulfillmentStatus} /></div>
              <div><span>Sales channel</span><strong>{label(order.SalesChannel)}</strong></div>
            </div>

            <div className={styles.detailLayout}>
              <div className={styles.detailMain}>
                <DetailSection title="Items" eyebrow={`${items.length} ${items.length === 1 ? "line item" : "line items"}`}>
                  {items.length ? (
                    <div className={styles.innerTableWrap}>
                      <table className={styles.innerTable}>
                        <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th className={styles.alignRight}>Total</th></tr></thead>
                        <tbody>{items.map((item) => <tr key={item.Id}>
                          <td><strong>{value(item.ProductName)}</strong>{item.VariantName && <small>{item.VariantName}</small>}</td>
                          <td>{value(item.SKU)}</td>
                          <td>{number(item.Quantity)}</td>
                          <td>{money(item.UnitPrice, currency)}</td>
                          <td className={styles.alignRight}><strong>{money(item.TotalAmount, currency)}</strong></td>
                        </tr>)}</tbody>
                      </table>
                    </div>
                  ) : <EmptyRows>No line items were captured for this order.</EmptyRows>}
                </DetailSection>

                <DetailSection title="Payments" eyebrow={`${(detail.payments || []).length} ${(detail.payments || []).length === 1 ? "transaction" : "transactions"}`}>
                  {detail.payments?.length ? <div className={styles.innerTableWrap}><table className={styles.innerTable}>
                    <thead><tr><th>Method</th><th>Provider</th><th>Reference</th><th>Status</th><th className={styles.alignRight}>Amount</th></tr></thead>
                    <tbody>{detail.payments.map((payment) => <tr key={payment.Id}>
                      <td>{label(payment.PaymentMethod)}</td><td>{label(payment.PaymentProvider)}</td><td className={styles.mono}>{value(payment.ExternalTransactionId)}</td><td><StatusPill status={payment.Status} /></td><td className={styles.alignRight}><strong>{money(payment.Amount, payment.Currency || currency)}</strong><small>{dateValue(payment.ProcessedAt || payment.CreatedAt)}</small></td>
                    </tr>)}</tbody>
                  </table></div> : <EmptyRows>No payment transactions are linked to this order.</EmptyRows>}
                </DetailSection>

                <DetailSection title="Fulfillment" eyebrow={`${(detail.shipments || []).length} ${(detail.shipments || []).length === 1 ? "shipment" : "shipments"}`}>
                  {detail.shipments?.length ? <div className={styles.fulfillmentList}>{detail.shipments.map((shipment) => <article className={styles.fulfillmentCard} key={shipment.Id}>
                    <div className={styles.fulfillmentTop}><div><strong>{value(shipment.ShipmentNumber)}</strong><span>{value(shipment.Supplier)}{shipment.Service ? ` · ${shipment.Service}` : ""}</span></div><StatusPill status={shipment.Status} /></div>
                    <div className={styles.fulfillmentMeta}><span>Carrier <strong>{value(shipment.Carrier)}</strong></span><span>Tracking <strong className={styles.mono}>{value(shipment.TrackingNumber)}</strong></span><span>Shipped <strong>{dateValue(shipment.ShippedAt)}</strong></span></div>
                    {shipment.TrackingUrl && <a className={styles.externalLink} href={shipment.TrackingUrl} target="_blank" rel="noreferrer">Open tracking <LaunchRoundedIcon fontSize="inherit" /></a>}
                  </article>)}</div> : <EmptyRows>No shipments have been created yet.</EmptyRows>}
                  {detail.supplierOrders?.length > 0 && <div className={styles.supplierOrders}><span className={styles.subsectionLabel}>Supplier orders</span>{detail.supplierOrders.map((supplierOrder) => <div className={styles.supplierRow} key={supplierOrder.Id}><span><strong>{value(supplierOrder.PurchaseOrderNumber)}</strong><small>{value(supplierOrder.Supplier)}{supplierOrder.ExternalOrderId ? ` · ${supplierOrder.ExternalOrderId}` : ""}</small></span><StatusPill status={supplierOrder.Status} /><strong>{money(supplierOrder.TotalCost, supplierOrder.Currency || currency)}</strong></div>)}</div>}
                </DetailSection>

                <DetailSection title="Order activity" eyebrow="Status and tracking history">
                  {(detail.history?.length || detail.trackingEvents?.length) ? <div className={styles.timeline}>
                    {[...(detail.history || []).map((event) => ({ ...event, kind: "status", date: event.CreatedAt, title: `${label(event.PreviousStatus)} → ${label(event.NewStatus)}`, description: event.Reason })), ...(detail.trackingEvents || []).map((event) => ({ ...event, kind: "tracking", date: event.EventAt, title: event.Status, description: event.Description, location: event.Location }))].sort((a, b) => new Date(b.date) - new Date(a.date)).map((event, index) => <div className={styles.timelineItem} key={`${event.Id || event.TrackingEventId}-${index}`}><span className={`${styles.timelineDot} ${event.kind === "tracking" ? styles.timelineTracking : ""}`} /><div><div className={styles.timelineTop}><strong>{value(event.title)}</strong><time>{dateValue(event.date, true)}</time></div>{event.description && <p>{event.description}</p>}{event.location && <small>{event.location}</small>}</div></div>)}
                  </div> : <EmptyRows>No activity has been recorded yet.</EmptyRows>}
                </DetailSection>
              </div>

              <aside className={styles.detailAside}>
                <DetailSection title="Order summary">
                  <div className={styles.summaryRows}>
                    <div><span>Subtotal</span><strong>{money(order.SubtotalAmount, currency)}</strong></div>
                    <div><span>Discount</span><strong>−{money(order.DiscountAmount, currency)}</strong></div>
                    <div><span>Shipping</span><strong>{money(order.ShippingAmount, currency)}</strong></div>
                    <div><span>Tax</span><strong>{money(order.TaxAmount, currency)}</strong></div>
                    <div className={styles.summaryTotal}><span>Total</span><strong>{money(order.TotalAmount, currency)}</strong></div>
                    {Number(order.RefundedAmount || 0) > 0 && <div className={styles.summaryRefund}><span>Refunded</span><strong>−{money(order.RefundedAmount, currency)}</strong></div>}
                  </div>
                </DetailSection>

                <DetailSection title="Order information">
                  <div className={styles.detailValues}>
                    <DetailValue label="Order ID" wide><span className={styles.mono}>{value(order.Id)}</span></DetailValue>
                    <DetailValue label="Source">{label(order.Source || order.SalesChannel)}</DetailValue>
                    <DetailValue label="Legacy order ID">{value(order.LegacyOrderId)}</DetailValue>
                    <DetailValue label="Created">{dateValue(order.CreatedAt, true)}</DetailValue>
                    <DetailValue label="Paid">{dateValue(order.PaidAt, true)}</DetailValue>
                    <DetailValue label="Completed">{dateValue(order.CompletedAt, true)}</DetailValue>
                    <DetailValue label="Cancelled">{dateValue(order.CancelledAt, true)}</DetailValue>
                    <DetailValue label="Last updated">{dateValue(order.UpdatedAt, true)}</DetailValue>
                  </div>
                </DetailSection>

                <DetailSection title="Customer">
                  <div className={styles.detailValues}>
                    {customerName && <DetailValue label="Name">{customerName}</DetailValue>}
                    <DetailValue label="Email" wide>{value(order.CustomerEmail)}</DetailValue>
                    <DetailValue label="Phone">{value(order.CustomerPhone)}</DetailValue>
                    <DetailValue label="Customer number">{value(order.CustomerNumber)}</DetailValue>
                  </div>
                </DetailSection>

                <DetailSection title="Addresses">
                  <div className={styles.addressList}><AddressCard address={shippingAddress} title="Shipping" /><AddressCard address={billingAddress} title="Billing" /></div>
                </DetailSection>

                {detail.invoices?.length > 0 && <DetailSection title="Invoices"><div className={styles.compactList}>{detail.invoices.map((invoice) => <div className={styles.compactRow} key={invoice.Id}><span><strong>{value(invoice.InvoiceNumber)}</strong><small>{label(invoice.Status)} · issued {dateValue(invoice.IssueDate)}</small></span><strong>{money(invoice.TotalAmount, invoice.Currency || currency)}</strong></div>)}</div></DetailSection>}
                {detail.refunds?.length > 0 && <DetailSection title="Refunds"><div className={styles.compactList}>{detail.refunds.map((refund) => <div className={styles.compactRow} key={refund.Id}><span><strong>{value(refund.RefundNumber)}</strong><small>{label(refund.Status)} · {value(refund.Reason)}</small></span><strong>{money(refund.Amount, refund.Currency || currency)}</strong></div>)}</div></DetailSection>}
              </aside>
            </div>
          </>}
        </div>
      </section>
    </div>
  );
}

export default function OrdersAdminPage({ title = "Orders" }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRequestRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => setFilters((current) => ({
      ...current,
      range: params.get("range") || current.range,
      from: params.get("from") || "",
      to: params.get("to") || "",
      currency: params.get("currency") || "",
      status: params.get("status") || params.get("orderStatus") || "",
      paymentStatus: params.get("paymentStatus") || "",
      fulfillmentStatus: params.get("fulfillmentStatus") || "",
    })));
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, filterValue]) => { if (filterValue) params.set(key, filterValue); });
    params.set("limit", "100");
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      setErrorCode("");
      try {
        const response = await fetch(`/api/admin/records/orders?${query}`, { credentials: "include", cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const requestError = new Error(body.error || "Unable to load orders");
          requestError.code = body.code || "";
          throw requestError;
        }
        if (active) setOrders(Array.isArray(body.rows) ? body.rows : []);
      } catch (requestError) {
        if (active) { setOrders([]); setError(requestError.message || "Unable to load orders"); setErrorCode(requestError.code || ""); }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [query, reloadKey]);

  const openDetails = useCallback(async (order) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelected(order);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.Id)}`, { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to load order details");
      if (detailRequestRef.current === requestId) setDetail(body);
    } catch (requestError) {
      if (detailRequestRef.current === requestId) setDetailError(requestError.message || "Unable to load order details");
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }, []);

  const closeDetails = useCallback(() => {
    detailRequestRef.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailError("");
  }, []);

  const retryDetails = useCallback(() => {
    if (selected) openDetails(selected);
  }, [openDetails, selected]);

  const visibleOrders = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return orders;
    return orders.filter((order) => [order.OrderNumber, order.CustomerEmail, order.OrderStatus, order.PaymentStatus, order.FulfillmentStatus].some((field) => String(field || "").toLowerCase().includes(queryText)));
  }, [orders, search]);

  const stats = useMemo(() => {
    const currency = filters.currency || orders[0]?.Currency || "USD";
    const revenue = orders.reduce((sum, order) => sum + Number(order.TotalAmount || 0), 0);
    const paid = orders.filter((order) => ["paid", "authorized"].includes(String(order.PaymentStatus || "").toLowerCase())).length;
    const attention = orders.filter((order) => ["pending", "failed", "cancelled", "canceled"].includes(String(order.OrderStatus || order.PaymentStatus || "").toLowerCase())).length;
    return { currency, revenue, paid, attention };
  }, [filters.currency, orders]);

  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setSearch(""); };

  if (loading && !orders.length && !error) return <TablePageSkeleton rows={8} columns={6} />;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard/Overview" className={styles.backLink}><ArrowBackRoundedIcon fontSize="inherit" /> Overview</Link>
          <p className={styles.eyebrow}>COMMERCE / OPERATIONS</p>
          <h1>{title}</h1>
          <p className={styles.subtitle}>Search, review, and follow every customer order from one place.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => setReloadKey((key) => key + 1)} disabled={loading}><RefreshRoundedIcon fontSize="small" /> {loading ? "Refreshing" : "Refresh"}</button>
      </header>

      <section className={styles.statsGrid} aria-label="Order summary">
        <StatCard icon={ShoppingBagOutlinedIcon} label="Orders in view" value={number(orders.length)} detail="Based on current filters" />
        <StatCard icon={ShoppingBagOutlinedIcon} label="Paid orders" value={number(stats.paid)} detail={orders.length ? `${Math.round((stats.paid / orders.length) * 100)}% of orders` : "No orders in view"} tone="green" />
        <StatCard icon={ShoppingBagOutlinedIcon} label="Sales in view" value={money(stats.revenue, stats.currency)} detail={`${stats.currency} order value`} tone="violet" />
        <StatCard icon={FilterListRoundedIcon} label="Needs attention" value={number(stats.attention)} detail="Pending, failed, or cancelled" tone="amber" />
      </section>

      <section className={styles.filtersCard} aria-label="Order filters">
        <div className={styles.searchField}><SearchRoundedIcon fontSize="small" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number or customer email" aria-label="Search orders" /></div>
        <label>Period<select value={filters.range} onChange={updateFilter("range")}>{RANGE_OPTIONS.map(([option, optionLabel]) => <option key={option} value={option}>{optionLabel}</option>)}</select></label>
        {filters.range === "custom" && <label>From<input type="date" value={filters.from} onChange={updateFilter("from")} /></label>}
        {filters.range === "custom" && <label>To<input type="date" value={filters.to} onChange={updateFilter("to")} /></label>}
        <label>Status<select value={filters.status} onChange={updateFilter("status")}><option value="">All statuses</option><option>Pending</option><option>Processing</option><option>Completed</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></label>
        <label>Payment<select value={filters.paymentStatus} onChange={updateFilter("paymentStatus")}><option value="">All payments</option><option>Pending</option><option>Authorized</option><option>Paid</option><option>Failed</option><option>Refunded</option></select></label>
        <label>Fulfillment<select value={filters.fulfillmentStatus} onChange={updateFilter("fulfillmentStatus")}><option value="">All fulfillment</option><option>Unfulfilled</option><option>Processing</option><option>Shipped</option><option>Delivered</option></select></label>
        <label>Currency<select value={filters.currency} onChange={updateFilter("currency")}><option value="">All currencies</option><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>AUD</option></select></label>
        <button type="button" className={styles.clearButton} onClick={clearFilters}>Clear filters</button>
      </section>

      {error && <div className={styles.errorMessage}><strong>{errorCode === "CANONICAL_SCHEMA_NOT_READY" ? "Database upgrade required." : "Orders unavailable."}</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}

      {!error && <section className={styles.tableCard}>
        <div className={styles.tableHeader}><div><h2>All orders</h2><p>{search ? `Showing ${visibleOrders.length} matches from ${orders.length} loaded orders` : `Showing ${orders.length} orders from the selected period`}</p></div><span className={styles.tableHint}>Select an order to view full details <ExpandMoreRoundedIcon fontSize="small" /></span></div>
        {visibleOrders.length ? <div className={styles.tableScroll}><table className={styles.ordersTable}><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Status</th><th>Payment</th><th>Fulfillment</th><th className={styles.alignRight}>Total</th><th aria-label="Actions" /></tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.Id || order.OrderNumber} onClick={() => openDetails(order)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetails(order); } }} tabIndex={0}>
          <td><button type="button" className={styles.orderNumber} onClick={(event) => { event.stopPropagation(); openDetails(order); }}>{value(order.OrderNumber)}<small>{String(order.Id || "").slice(0, 8)}</small></button></td>
          <td><span className={styles.customerCell}>{value(order.CustomerEmail)}</span></td>
          <td className={styles.dateCell}>{dateValue(order.CreatedAt || order.PlacedAt)}</td>
          <td><StatusPill status={order.OrderStatus} /></td>
          <td><StatusPill status={order.PaymentStatus} /></td>
          <td><StatusPill status={order.FulfillmentStatus} /></td>
          <td className={`${styles.alignRight} ${styles.totalCell}`}>{money(order.TotalAmount, order.Currency)}</td>
          <td><button type="button" className={styles.viewButton} onClick={(event) => { event.stopPropagation(); openDetails(order); }}>View <LaunchRoundedIcon fontSize="inherit" /></button></td>
        </tr>)}</tbody></table></div> : <div className={styles.emptyState}><div className={styles.emptyIcon}><ShoppingBagOutlinedIcon /></div><h3>{search ? "No matching orders" : "No orders in this period"}</h3><p>{search ? "Try a different order number, status, or customer email." : "Try widening the date range or clearing the filters."}</p></div>}
        <div className={styles.tableFooter}><span>Up to 100 orders are loaded at a time.</span><span>Click any row for full order detail.</span></div>
      </section>}

      <DetailModal selected={selected} detail={detail} loading={detailLoading} error={detailError} onClose={closeDetails} onRetry={retryDetails} />
    </main>
  );
}
