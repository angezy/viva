"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./overview.module.css";

const RANGE_OPTIONS = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["last7", "Last 7 days"],
  ["last30", "Last 30 days"], ["thisMonth", "This month"],
  ["lastMonth", "Last month"], ["thisYear", "This year"], ["custom", "Custom"]
];

const SECTION_TITLES = {
  sales: "Sales", finance: "Finance", products: "Products & inventory",
  fulfillment: "Orders & fulfillment", suppliers: "Suppliers", customers: "Customers",
  support: "Support", marketing: "Marketing", loyalty: "Loyalty"
};

function money(value, currency) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function number(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(Number(value || 0));
}

function MetricCard({ label, value, href, tone = "blue", note }) {
  return (
    <Link className={`${styles.metricCard} ${styles[tone]}`} href={href}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.metricNote}>{note || "View underlying records →"}</span>
    </Link>
  );
}

function Section({ title, children, id }) {
  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHeader}><h2>{title}</h2></div>
      <div className={styles.metricGrid}>{children}</div>
    </section>
  );
}

function EmptyRows({ children }) {
  return <div className={styles.empty}>{children}</div>;
}

export default function Overview() {
  const [filters, setFilters] = useState({ range: "last30", from: "", to: "", currency: "USD", country: "", orderStatus: "" });
  const [data, setData] = useState(null);
  // Keep the first server/client render identical. The initial request starts
  // in useEffect immediately after hydration and then switches this to true.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const response = await fetch(`/api/admin/overview?${query}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestError = new Error(payload.error || `Overview request failed (${response.status})`);
        requestError.code = payload.code || "";
        throw requestError;
      }
      setData(payload);
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard metrics");
      setErrorCode(requestError.code || "");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const setFilter = (key) => (event) => setFilters(current => ({ ...current, [key]: event.target.value }));
  const currency = filters.currency || "USD";
  const drill = (path, params = {}) => {
    const target = new URLSearchParams();
    Object.entries({ range: filters.range, from: filters.from, to: filters.to, currency, country: filters.country, ...params })
      .forEach(([key, value]) => { if (value) target.set(key, value); });
    return `${path}?${target.toString()}`;
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ADMIN OVERVIEW</p>
          <h1>Weluxo operating dashboard</h1>
          <p>Live aggregates from Commerce, ERP, and CRM tables. No sample values are shown.</p>
        </div>
        <button className={styles.refresh} type="button" onClick={loadOverview} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </header>

      <section className={styles.filters} aria-label="Dashboard filters">
        <label>Period<select value={filters.range} onChange={setFilter("range")}>{RANGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {filters.range === "custom" && <label>From<input type="date" value={filters.from} onChange={setFilter("from")} /></label>}
        {filters.range === "custom" && <label>To<input type="date" value={filters.to} onChange={setFilter("to")} /></label>}
        <label>Currency<input value={filters.currency} maxLength={3} onChange={setFilter("currency")} placeholder="USD" /></label>
        <label>Country<input value={filters.country} maxLength={2} onChange={setFilter("country")} placeholder="All" /></label>
        <label>Order status<select value={filters.orderStatus} onChange={setFilter("orderStatus")}><option value="">All</option><option>Pending</option><option>Processing</option><option>Completed</option><option>Cancelled</option></select></label>
      </section>

      {error && <div className={styles.error}><strong>{errorCode === "CANONICAL_SCHEMA_NOT_READY" ? "Database upgrade required." : "Dashboard unavailable."}</strong> {error}<button type="button" onClick={loadOverview}>Try again</button></div>}
      {loading && !data && <div className={styles.loading}>Calculating current metrics from the database…</div>}

      {data && <>
        <div className={styles.timestamp}>Updated {new Date(data.generatedAt).toLocaleString()} · {new Date(data.range.start).toLocaleDateString()}–{new Date(new Date(data.range.endExclusive).getTime() - 1).toLocaleDateString()}</div>

        <Section title={SECTION_TITLES.sales} id="sales">
          <MetricCard label="Revenue in period" value={money(data.sales.revenuePeriod, currency)} href={drill("/dashboard/orders")} tone="blue" />
          <MetricCard label="Revenue today" value={money(data.sales.revenueToday, currency)} href={drill("/dashboard/orders", { range: "today" })} tone="blue" />
          <MetricCard label="Revenue this month" value={money(data.sales.revenueThisMonth, currency)} href={drill("/dashboard/orders", { range: "thisMonth" })} tone="blue" />
          <MetricCard label="Orders in period" value={number(data.sales.ordersPeriod)} href={drill("/dashboard/orders")} tone="violet" />
          <MetricCard label="Orders today" value={number(data.sales.ordersToday)} href={drill("/dashboard/orders", { range: "today" })} tone="violet" />
          <MetricCard label="Orders this month" value={number(data.sales.ordersThisMonth)} href={drill("/dashboard/orders", { range: "thisMonth" })} tone="violet" />
          <MetricCard label="Average order value" value={money(data.sales.averageOrderValue, currency)} href={drill("/dashboard/orders")} tone="violet" />
          <MetricCard label="Paid orders" value={number(data.sales.paidOrders)} href={drill("/dashboard/orders", { paymentStatus: "Paid" })} tone="green" />
          <MetricCard label="Pending payment" value={number(data.sales.pendingOrders)} href={drill("/dashboard/orders", { paymentStatus: "Pending" })} tone="amber" />
          <MetricCard label="Cancelled orders" value={number(data.sales.cancelledOrders)} href={drill("/dashboard/orders", { orderStatus: "Cancelled" })} tone="rose" />
          <MetricCard label="Refunds" value={money(data.sales.refundAmount, currency)} href={drill("/dashboard/finance", { view: "refunds" })} tone="rose" />
        </Section>

        <Section title={SECTION_TITLES.finance} id="finance">
          <MetricCard label="Gross sales" value={money(data.finance.grossSales, currency)} href={drill("/dashboard/finance", { view: "sales" })} />
          <MetricCard label="COGS" value={money(data.finance.cogs, currency)} href={drill("/dashboard/finance", { view: "cogs" })} tone="amber" />
          <MetricCard label="Gross profit" value={money(data.finance.grossProfit, currency)} href={drill("/dashboard/finance", { view: "profit" })} tone="green" />
          <MetricCard label="Gross margin" value={`${number(data.finance.grossMarginPercent, 1)}%`} href={drill("/dashboard/finance", { view: "profit" })} tone="green" />
          <MetricCard label="Operating expenses" value={money(data.finance.operatingExpenses, currency)} href={drill("/dashboard/finance", { view: "expenses" })} tone="rose" />
          <MetricCard label="Net profit" value={money(data.finance.netProfit, currency)} href={drill("/dashboard/finance", { view: "profit" })} tone="green" />
          <MetricCard label="Cash position" value={money(data.finance.cashPosition, currency)} href={drill("/dashboard/finance", { view: "payments" })} tone="violet" />
          <MetricCard label="Accounts receivable" value={money(data.finance.accountsReceivable, currency)} href={drill("/dashboard/finance", { view: "receivables" })} tone="amber" />
          <MetricCard label="Accounts payable" value={money(data.finance.accountsPayable, currency)} href={drill("/dashboard/finance", { view: "payables" })} tone="rose" />
          <MetricCard label="Tax collected" value={money(data.finance.taxCollected, currency)} href={drill("/dashboard/finance", { view: "tax-collected" })} tone="violet" />
          <MetricCard label="Tax payable" value={money(data.finance.taxPayable, currency)} href={drill("/dashboard/finance", { view: "tax-payable" })} tone="amber" />
        </Section>

        <Section title={SECTION_TITLES.products} id="products">
          <MetricCard label="Active products" value={number(data.products.activeProducts)} href={drill("/dashboard/products", { status: "Active" })} />
          <MetricCard label="Draft products" value={number(data.products.draftProducts)} href={drill("/dashboard/products", { status: "Draft" })} tone="violet" />
          <MetricCard label="Low stock" value={number(data.products.lowStockProducts)} href={drill("/dashboard/products", { stock: "low" })} tone="amber" />
          <MetricCard label="Out of stock" value={number(data.products.outOfStockProducts)} href={drill("/dashboard/products", { stock: "out" })} tone="rose" />
          <MetricCard label="Inventory cost" value={money(data.products.inventoryCost, currency)} href={drill("/dashboard/products", { view: "inventory-cost" })} tone="amber" />
          <MetricCard label="Profit potential" value={money(data.products.inventoryProfitPotential, currency)} href={drill("/dashboard/products", { view: "profit-potential" })} tone="green" />
        </Section>

        <Section title={SECTION_TITLES.fulfillment} id="fulfillment">
          <MetricCard label="Awaiting payment" value={number(data.fulfillment.awaitingPayment)} href={drill("/dashboard/orders", { paymentStatus: "Pending" })} tone="amber" />
          <MetricCard label="Awaiting fulfillment" value={number(data.fulfillment.awaitingFulfillment)} href={drill("/dashboard/orders", { fulfillmentStatus: "Unfulfilled" })} tone="amber" />
          <MetricCard label="Processing" value={number(data.fulfillment.processing)} href={drill("/dashboard/orders", { orderStatus: "Processing" })} />
          <MetricCard label="Shipped" value={number(data.fulfillment.shipped)} href={drill("/dashboard/orders", { shipmentStatus: "Shipped" })} tone="violet" />
          <MetricCard label="Delivered" value={number(data.fulfillment.delivered)} href={drill("/dashboard/orders", { shipmentStatus: "Delivered" })} tone="green" />
          <MetricCard label="Shipping exceptions" value={number(data.fulfillment.shippingExceptions)} href={drill("/dashboard/orders", { shipmentStatus: "Exception" })} tone="rose" />
        </Section>

        <Section title={SECTION_TITLES.suppliers} id="suppliers">
          <MetricCard label="Active suppliers" value={number(data.suppliers.activeSuppliers)} href={drill("/dashboard/suppliers", { status: "Active" })} />
          <MetricCard label="Orders pending" value={number(data.suppliers.ordersPending)} href={drill("/dashboard/suppliers", { view: "orders", status: "Pending" })} tone="amber" />
          <MetricCard label="Orders delayed" value={number(data.suppliers.ordersDelayed)} href={drill("/dashboard/suppliers", { view: "orders", status: "Delayed" })} tone="rose" />
          <MetricCard label="Sync failures" value={number(data.suppliers.syncFailures)} href={drill("/dashboard/suppliers", { view: "sync", status: "Failed" })} tone="rose" />
          <MetricCard label="Cost warnings" value={number(data.suppliers.costWarnings)} href={drill("/dashboard/suppliers", { view: "cost-warnings" })} tone="amber" />
        </Section>

        <Section title={SECTION_TITLES.customers} id="customers">
          <MetricCard label="Total customers" value={number(data.customers.totalCustomers)} href={drill("/dashboard/user")} />
          <MetricCard label="New today" value={number(data.customers.newToday)} href={drill("/dashboard/user", { joined: "today" })} tone="green" />
          <MetricCard label="New this month" value={number(data.customers.newThisMonth)} href={drill("/dashboard/user", { joined: "thisMonth" })} tone="green" />
          <MetricCard label="Returning customers" value={number(data.customers.returningCustomers)} href={drill("/dashboard/user", { segment: "returning" })} tone="violet" />
          <MetricCard label="With open tickets" value={number(data.customers.customersWithOpenTickets)} href={drill("/dashboard/tikects", { status: "open" })} tone="amber" />
        </Section>

        <Section title={SECTION_TITLES.support} id="support">
          <MetricCard label="Open tickets" value={number(data.support.openTickets)} href={drill("/dashboard/tikects", { status: "open" })} />
          <MetricCard label="Urgent tickets" value={number(data.support.urgentTickets)} href={drill("/dashboard/tikects", { priority: "Urgent" })} tone="rose" />
          <MetricCard label="Unassigned" value={number(data.support.unassignedTickets)} href={drill("/dashboard/tikects", { assigned: "none" })} tone="amber" />
          <MetricCard label="Average resolution" value={`${number(data.support.averageResolutionHours, 1)} hr`} href={drill("/dashboard/tikects", { status: "resolved" })} tone="green" />
        </Section>

        <Section title={SECTION_TITLES.marketing} id="marketing">
          <MetricCard label="Active campaigns" value={number(data.marketing.activeCampaigns)} href={drill("/dashboard/marketing", { status: "Active" })} />
          <MetricCard label="Attributed revenue" value={money(data.marketing.revenue, currency)} href={drill("/dashboard/marketing", { view: "revenue" })} tone="green" />
          <MetricCard label="Attributed orders" value={number(data.marketing.orders)} href={drill("/dashboard/marketing", { view: "orders" })} tone="violet" />
          <MetricCard label="ROI" value={data.marketing.roiPercent == null ? "—" : `${number(data.marketing.roiPercent, 1)}%`} href={drill("/dashboard/marketing", { view: "roi" })} tone="amber" />
        </Section>

        <Section title={SECTION_TITLES.loyalty} id="loyalty">
          <MetricCard label="Active members" value={number(data.loyalty.activeMembers)} href={drill("/dashboard/loyalty", { view: "members" })} />
          <MetricCard label="Points issued" value={number(data.loyalty.pointsIssued)} href={drill("/dashboard/loyalty", { transactionType: "Earn" })} tone="green" />
          <MetricCard label="Points redeemed" value={number(data.loyalty.pointsRedeemed)} href={drill("/dashboard/loyalty", { transactionType: "Redeem" })} tone="violet" />
        </Section>

        <section className={styles.detailGrid}>
          <article className={styles.tablePanel}><h2>Top products</h2>{data.products.topProducts.length ? <div className={styles.rows}>{data.products.topProducts.map(item => <Link key={item.id} href={drill("/dashboard/products", { product: item.id })}><span><strong>{item.name}</strong><small>{item.sku || "No SKU"} · {number(item.units, 2)} units</small></span><b>{money(item.revenue, currency)}</b></Link>)}</div> : <EmptyRows>No sales match the selected filters.</EmptyRows>}</article>
          <article className={styles.tablePanel}><h2>Top customers</h2>{data.customers.topCustomers.length ? <div className={styles.rows}>{data.customers.topCustomers.map(item => <Link key={item.id} href={drill("/dashboard/user", { customer: item.id })}><span><strong>{item.displayName}</strong><small>{item.customerNumber} · {number(item.orders)} orders</small></span><b>{money(item.lifetimeValue, currency)}</b></Link>)}</div> : <EmptyRows>No customers match the selected filters.</EmptyRows>}</article>
          <article className={styles.tablePanel}><h2>Recent support tickets</h2>{data.support.recentTickets.length ? <div className={styles.rows}>{data.support.recentTickets.map(item => <Link key={item.id} href={`/dashboard/tikects?ticket=${item.id}`}><span><strong>{item.subject}</strong><small>{item.ticketNumber} · {item.priority}</small></span><b>{item.status}</b></Link>)}</div> : <EmptyRows>No support tickets found.</EmptyRows>}</article>
          <article className={styles.tablePanel}><h2>Customers by loyalty tier</h2>{data.loyalty.customersByTier.length ? <div className={styles.rows}>{data.loyalty.customersByTier.map(item => <Link key={item.tier} href={drill("/dashboard/loyalty", { tier: item.tier })}><span><strong>{item.tier}</strong><small>Loyalty members</small></span><b>{number(item.customers)}</b></Link>)}</div> : <EmptyRows>No loyalty accounts found.</EmptyRows>}</article>
        </section>
      </>}
    </main>
  );
}
