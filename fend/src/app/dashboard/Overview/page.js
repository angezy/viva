"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./overview.module.css";
import PageSkeleton from "../../components/LoadingSkeletons";

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 days"],
  ["last30", "Last 30 days"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["thisYear", "This year"],
  ["custom", "Custom"]
];

const SECTION_TITLES = {
  sales: "Sales",
  finance: "Finance",
  products: "Products & inventory",
  fulfillment: "Orders & fulfillment",
  suppliers: "Suppliers",
  customers: "Customers",
  support: "Support",
  marketing: "Marketing",
  loyalty: "Loyalty"
};

const COLORS = {
  blue: "var(--color-primary)",
  sky: "#0ea5e9",
  green: "var(--color-success)",
  amber: "#d98a06",
  rose: "#e05270",
  violet: "#805ad5",
  slate: "#64748b"
};

function money(value, currency) {
  const code = /^[A-Za-z]{3}$/.test(String(currency || "")) ? String(currency).toUpperCase() : "USD";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function number(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(Number(value || 0));
}

function compact(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits }).format(Number(value || 0));
}

function safeCurrency(currency) {
  return /^[A-Za-z]{3}$/.test(String(currency || "")) ? String(currency).toUpperCase() : "USD";
}

function axisValue(value, metric, currency) {
  if (metric === "orders") return compact(value, 1);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: safeCurrency(currency),
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function fillDailySeries(range, rawSeries = []) {
  if (!range?.start || !range?.endExclusive) return [];
  const byDay = new Map(rawSeries.map(item => [String(item.date).slice(0, 10), item]));
  const points = [];
  const cursor = new Date(range.start);
  const end = new Date(range.endExclusive);

  while (cursor < end) {
    const date = dayKey(cursor);
    const item = byDay.get(date) || {};
    points.push({
      date,
      revenue: Number(item.revenue || 0),
      orders: Number(item.orders || 0),
      paidOrders: Number(item.paidOrders || 0),
      cancelledOrders: Number(item.cancelledOrders || 0)
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

function ChartPanel({ title, subtitle, children, href, className = "" }) {
  return (
    <article className={`${styles.chartPanel} ${className}`}>
      <div className={styles.chartHeader}>
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {href && <Link href={href} className={styles.chartLink}>View details</Link>}
      </div>
      {children}
    </article>
  );
}

function BarChart({ items, emptyLabel = "No data for the selected filters" }) {
  const maxValue = Math.max(...items.map(item => Math.abs(Number(item.value || 0))), 0);

  if (!items.length) return <div className={styles.chartEmpty}>{emptyLabel}</div>;

  return (
    <div className={styles.barChart}>
      {items.map((item) => {
        const value = Number(item.value || 0);
        const width = maxValue > 0 ? Math.max(value === 0 ? 0 : 5, (Math.abs(value) / maxValue) * 100) : 0;
        const row = (
          <>
            <span className={styles.barTopline}>
              <span className={styles.barLabel}>
                <i style={{ backgroundColor: item.color || COLORS.blue }} />
                {item.label}
              </span>
              <strong>{item.display ?? number(value)}</strong>
            </span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${width}%`, backgroundColor: item.color || COLORS.blue }} />
            </span>
          </>
        );

        return item.href ? (
          <Link className={styles.barRow} href={item.href} key={item.label}>
            {row}
          </Link>
        ) : (
          <div className={styles.barRow} key={item.label}>
            {row}
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ items, centerValue, centerLabel }) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value || 0)), 0);
  let offset = 0;

  if (!items.length || total === 0) return <div className={styles.chartEmpty}>No composition data for the selected filters.</div>;

  return (
    <div className={styles.donutLayout}>
      <div className={styles.donutWrap}>
        <svg className={styles.donut} viewBox="0 0 120 120" role="img" aria-label={centerLabel}>
          <circle className={styles.donutTrack} cx="60" cy="60" r="45" pathLength="100" />
          {total > 0 && items.map((item) => {
            const value = Math.max(0, Number(item.value || 0));
            const share = (value / total) * 100;
            const segment = (
              <circle
                className={styles.donutSegment}
                cx="60"
                cy="60"
                r="45"
                pathLength="100"
                stroke={item.color || COLORS.blue}
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-offset}
                key={item.label}
              />
            );
            offset += share;
            return segment;
          })}
        </svg>
        <div className={styles.donutCenter}>
          <strong>{centerValue ?? number(total)}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className={styles.donutLegend}>
        {items.map(item => {
          const content = <><span><i style={{ backgroundColor: item.color || COLORS.blue }} />{item.label}</span><strong>{item.display ?? number(item.value)}</strong></>;
          return item.href ? <Link className={styles.legendRow} href={item.href} key={item.label}>{content}</Link> : <div className={styles.legendRow} key={item.label}>{content}</div>;
        })}
      </div>
    </div>
  );
}

function TimeSeriesChart({ points, metric, currency }) {
  const valueKey = metric === "orders" ? "orders" : "revenue";
  const values = points.map(point => Number(point[valueKey] || 0));
  const maxValue = Math.max(...values, 0);
  const chartMax = maxValue || 1;
  const width = 780;
  const height = 270;
  const left = 58;
  const right = 20;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = (index) => left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value) => top + plotHeight - (Number(value || 0) / chartMax) * plotHeight;
  const line = points.map((point, index) => `${xFor(index)},${yFor(point[valueKey])}`).join(" ");
  const area = points.length ? `${left},${top + plotHeight} ${line} ${xFor(points.length - 1)},${top + plotHeight}` : "";
  const tickValues = [1, .75, .5, .25, 0].map(ratio => chartMax * ratio);
  const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const labelStep = points.length <= 7 ? 1 : points.length <= 14 ? 2 : Math.ceil(points.length / 7);
  const labelIndexes = points.map((_, index) => index).filter(index => index % labelStep === 0 || index === points.length - 1);
  const peakIndex = values.reduce((best, value, index) => value > values[best] ? index : best, 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const formatValue = (value) => metric === "orders" ? number(value) : money(value, currency);

  if (!points.length) return <div className={styles.chartEmpty}>No daily data for the selected filters.</div>;

  return (
    <div className={styles.timeSeries}>
      <svg className={styles.timeSeriesSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric === "orders" ? "Orders" : "Revenue"} by day`}>
        <defs>
          <linearGradient id={`trend-fill-${metric}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={COLORS.blue} stopOpacity=".24" />
            <stop offset="100%" stopColor={COLORS.blue} stopOpacity=".02" />
          </linearGradient>
        </defs>
        {tickValues.map((tick, index) => {
          const y = yFor(tick);
          return (
            <g key={index}>
              <line className={styles.timeSeriesGridline} x1={left} x2={width - right} y1={y} y2={y} />
              <text className={styles.timeSeriesYLabel} x={left - 10} y={y + 4} textAnchor="end">{axisValue(tick, metric, currency)}</text>
            </g>
          );
        })}
        {area && <polygon className={styles.timeSeriesArea} points={area} fill={`url(#trend-fill-${metric})`} />}
        {line && <polyline className={styles.timeSeriesLine} points={line} />}
        {points.map((point, index) => (
          <circle className={styles.timeSeriesPoint} cx={xFor(index)} cy={yFor(point[valueKey])} r="4" key={point.date}>
            <title>{`${point.date}: ${formatValue(point[valueKey])}`}</title>
          </circle>
        ))}
        {labelIndexes.map(index => (
          <text className={styles.timeSeriesXLabel} x={xFor(index)} y={height - 13} textAnchor="middle" key={points[index].date}>
            {dateFormatter.format(new Date(`${points[index].date}T00:00:00.000Z`))}
          </text>
        ))}
      </svg>
      <div className={styles.trendSummary}>
        <span><small>Total</small><strong>{formatValue(total)}</strong></span>
        <span><small>Peak day</small><strong>{dateFormatter.format(new Date(`${points[peakIndex].date}T00:00:00.000Z`))}</strong></span>
        <span><small>Peak value</small><strong>{formatValue(values[peakIndex])}</strong></span>
      </div>
    </div>
  );
}

function InlineInsight({ label, value, tone = "blue" }) {
  return (
    <div className={`${styles.inlineInsight} ${styles[`insight${tone}`]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Section({ title, id, children }) {
  return (
    <section className={styles.section} id={id}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.sectionKicker}>OPERATING AREA</span>
          <h2>{title}</h2>
        </div>
        <a href="#top" className={styles.backToTop}>Back to top</a>
      </div>
      <div className={styles.chartGrid}>{children}</div>
    </section>
  );
}

function EmptyRows({ children }) {
  return <div className={styles.empty}>{children}</div>;
}

export default function Overview() {
  const [filters, setFilters] = useState({ range: "last7", from: "", to: "", currency: "USD", country: "", orderStatus: "" });
  const [data, setData] = useState(null);
  const [trendMetric, setTrendMetric] = useState("revenue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
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

  useEffect(() => { queueMicrotask(loadOverview); }, [loadOverview]);

  const setFilter = (key) => (event) => setFilters(current => ({ ...current, [key]: event.target.value }));
  const currency = filters.currency || "USD";
  const dailySeries = useMemo(() => fillDailySeries(data?.range, data?.series?.salesByDay), [data]);
  const drill = (path, params = {}) => {
    const target = new URLSearchParams();
    Object.entries({ range: filters.range, from: filters.from, to: filters.to, currency, country: filters.country, ...params })
      .forEach(([key, value]) => { if (value) target.set(key, value); });
    return `${path}?${target.toString()}`;
  };

  if (loading && !data) return <PageSkeleton variant="dashboard" />;

  return (
    <main className={styles.page} id="top">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ADMIN OVERVIEW</p>
          <h1>Weluxo operating dashboard</h1>
          <p>See what is moving, what needs attention, and where revenue is being made.</p>
        </div>
        <button className={styles.refresh} type="button" onClick={loadOverview} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh data"}
        </button>
      </header>

      <section className={styles.filters} aria-label="Dashboard filters">
        <label>Period<select value={filters.range} onChange={setFilter("range")}>{RANGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {filters.range === "custom" && <label>From<input type="date" value={filters.from} onChange={setFilter("from")} /></label>}
        {filters.range === "custom" && <label>To<input type="date" value={filters.to} onChange={setFilter("to")} /></label>}
        <label>Currency<input value={filters.currency} maxLength={3} onChange={setFilter("currency")} placeholder="USD" /></label>
        <label>Country<input value={filters.country} maxLength={2} onChange={setFilter("country")} placeholder="All" /></label>
        <label>Order status<select value={filters.orderStatus} onChange={setFilter("orderStatus")}><option value="">All</option><option>Pending</option><option>Processing</option><option>Completed</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></label>
      </section>

      {error && <div className={styles.error}><strong>{errorCode === "CANONICAL_SCHEMA_NOT_READY" ? "Database upgrade required." : "Dashboard unavailable."}</strong> {error}<button type="button" onClick={loadOverview}>Try again</button></div>}
      {data && <>
        <div className={styles.timestamp}>
          Updated {new Date(data.generatedAt).toLocaleString()} <span aria-hidden="true">&middot;</span> {new Date(data.range.start).toLocaleDateString()} - {new Date(new Date(data.range.endExclusive).getTime() - 1).toLocaleDateString()}
        </div>

        <nav className={styles.sectionNav} aria-label="Overview sections">
          {Object.entries(SECTION_TITLES).map(([id, title]) => <a href={`#${id}`} key={id}>{title}</a>)}
        </nav>

        <Section title={SECTION_TITLES.sales} id="sales">
          <ChartPanel title="Daily sales trend" subtitle="Real order data grouped by calendar day for the selected period." href={drill("/dashboard/orders")} className={styles.featurePanel}>
            <div className={styles.trendControls}>
              <div className={styles.trendTabs} role="group" aria-label="Daily chart metric">
                <button type="button" className={trendMetric === "revenue" ? styles.activeTrend : ""} onClick={() => setTrendMetric("revenue")}>Revenue</button>
                <button type="button" className={trendMetric === "orders" ? styles.activeTrend : ""} onClick={() => setTrendMetric("orders")}>Orders</button>
              </div>
              <span className={styles.trendPeriod}>{RANGE_OPTIONS.find(([value]) => value === filters.range)?.[1] || "Selected period"}</span>
            </div>
            <TimeSeriesChart points={dailySeries} metric={trendMetric} currency={currency} />
          </ChartPanel>
          <ChartPanel title="Order outcomes" subtitle="Count comparison for orders in the selected period." href={drill("/dashboard/orders")}>
            <BarChart items={[
              { label: "Paid", value: data.sales.paidOrders, color: COLORS.green, href: drill("/dashboard/orders", { paymentStatus: "Paid" }) },
              { label: "Pending payment", value: data.sales.pendingOrders, color: COLORS.amber, href: drill("/dashboard/orders", { paymentStatus: "Pending" }) },
              { label: "Cancelled", value: data.sales.cancelledOrders, color: COLORS.rose, href: drill("/dashboard/orders", { orderStatus: "Cancelled" }) }
            ]} />
            <div className={styles.insightRow}>
              <InlineInsight label="Orders in period" value={number(data.sales.ordersPeriod)} />
              <InlineInsight label="Average order value" value={money(data.sales.averageOrderValue, currency)} tone="violet" />
              <InlineInsight label="Refunds" value={money(data.sales.refundAmount, currency)} tone="rose" />
            </div>
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.finance} id="finance">
          <ChartPanel title="Profit profile" subtitle="Revenue, cost, and profit shown on one scale for the selected period." href={drill("/dashboard/finance", { view: "profit" })}>
            <BarChart items={[
              { label: "Gross sales", value: data.finance.grossSales, display: money(data.finance.grossSales, currency), color: COLORS.blue },
              { label: "Refunds", value: data.sales.refundAmount, display: money(data.sales.refundAmount, currency), color: COLORS.rose },
              { label: "COGS", value: data.finance.cogs, display: money(data.finance.cogs, currency), color: COLORS.amber },
              { label: "Operating expenses", value: data.finance.operatingExpenses, display: money(data.finance.operatingExpenses, currency), color: COLORS.rose },
              { label: "Net profit", value: data.finance.netProfit, display: money(data.finance.netProfit, currency), color: COLORS.green }
            ]} />
            <div className={styles.insightRow}><InlineInsight label="Gross margin" value={`${number(data.finance.grossMarginPercent, 1)}%`} tone="green" /></div>
          </ChartPanel>
          <ChartPanel title="Cash and tax exposure" subtitle="Balances and tax movement that deserve a closer look." href={drill("/dashboard/finance")}>
            <BarChart items={[
              { label: "Cash position", value: data.finance.cashPosition, display: money(data.finance.cashPosition, currency), color: COLORS.violet },
              { label: "Accounts receivable", value: data.finance.accountsReceivable, display: money(data.finance.accountsReceivable, currency), color: COLORS.sky },
              { label: "Accounts payable", value: data.finance.accountsPayable, display: money(data.finance.accountsPayable, currency), color: COLORS.rose },
              { label: "Tax collected", value: data.finance.taxCollected, display: money(data.finance.taxCollected, currency), color: COLORS.green },
              { label: "Tax payable", value: data.finance.taxPayable, display: money(data.finance.taxPayable, currency), color: COLORS.amber }
            ]} />
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.products} id="products">
          <ChartPanel title="Catalog mix" subtitle="Published and draft products in the catalog." href={drill("/dashboard/products")}>
            <DonutChart
              items={[
                { label: "Active products", value: data.products.activeProducts, color: COLORS.green, href: drill("/dashboard/products", { status: "Active" }) },
                { label: "Draft products", value: data.products.draftProducts, color: COLORS.violet, href: drill("/dashboard/products", { status: "Draft" }) }
              ]}
              centerValue={number(data.products.activeProducts + data.products.draftProducts)}
              centerLabel="catalog products"
            />
          </ChartPanel>
          <ChartPanel title="Inventory risk" subtitle="Variants that may interrupt availability." href={drill("/dashboard/products", { stock: "low" })}>
            <BarChart items={[
              { label: "Low-stock variants", value: data.products.lowStockProducts, color: COLORS.amber, href: drill("/dashboard/products", { stock: "low" }) },
              { label: "Out-of-stock variants", value: data.products.outOfStockProducts, color: COLORS.rose, href: drill("/dashboard/products", { stock: "out" }) }
            ]} />
            <div className={styles.insightRow}>
              <InlineInsight label="Inventory cost" value={money(data.products.inventoryCost, currency)} tone="amber" />
              <InlineInsight label="Profit potential" value={money(data.products.inventoryProfitPotential, currency)} tone="green" />
            </div>
          </ChartPanel>
          <ChartPanel title="Inventory value" subtitle="Current cost, retail value, and unrealized margin." href={drill("/dashboard/products", { view: "inventory-cost" })}>
            <BarChart items={[
              { label: "Inventory cost", value: data.products.inventoryCost, display: money(data.products.inventoryCost, currency), color: COLORS.amber },
              { label: "Retail value", value: data.products.inventoryRetailValue, display: money(data.products.inventoryRetailValue, currency), color: COLORS.blue },
              { label: "Profit potential", value: data.products.inventoryProfitPotential, display: money(data.products.inventoryProfitPotential, currency), color: COLORS.green }
            ]} />
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.fulfillment} id="fulfillment">
          <ChartPanel title="Order flow" subtitle="Where selected-period orders are sitting right now." href={drill("/dashboard/orders")} className={styles.featurePanel}>
            <BarChart items={[
              { label: "Awaiting payment", value: data.fulfillment.awaitingPayment, color: COLORS.amber, href: drill("/dashboard/orders", { paymentStatus: "Pending" }) },
              { label: "Awaiting fulfillment", value: data.fulfillment.awaitingFulfillment, color: COLORS.amber, href: drill("/dashboard/orders", { fulfillmentStatus: "Unfulfilled" }) },
              { label: "Processing", value: data.fulfillment.processing, color: COLORS.blue, href: drill("/dashboard/orders", { orderStatus: "Processing" }) },
              { label: "Shipped", value: data.fulfillment.shipped, color: COLORS.violet, href: drill("/dashboard/orders", { fulfillmentStatus: "Shipped" }) },
              { label: "Delivered", value: data.fulfillment.delivered, color: COLORS.green, href: drill("/dashboard/orders", { fulfillmentStatus: "Delivered" }) },
              { label: "Shipping exceptions", value: data.fulfillment.shippingExceptions, color: COLORS.rose, href: drill("/dashboard/orders", { fulfillmentStatus: "Exception" }) }
            ]} />
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.suppliers} id="suppliers">
          <ChartPanel title="Supplier health" subtitle="Active relationships and current operational warnings." href={drill("/dashboard/suppliers")}>
            <BarChart items={[
              { label: "Active suppliers", value: data.suppliers.activeSuppliers, color: COLORS.green, href: drill("/dashboard/suppliers", { status: "Active" }) },
              { label: "Orders pending", value: data.suppliers.ordersPending, color: COLORS.amber, href: drill("/dashboard/suppliers", { view: "orders", status: "Pending" }) },
              { label: "Orders delayed", value: data.suppliers.ordersDelayed, color: COLORS.rose, href: drill("/dashboard/suppliers", { view: "orders", status: "Delayed" }) },
              { label: "Sync failures", value: data.suppliers.syncFailures, color: COLORS.rose, href: drill("/dashboard/suppliers", { view: "sync", status: "Failed" }) },
              { label: "Cost warnings", value: data.suppliers.costWarnings, color: COLORS.amber, href: drill("/dashboard/suppliers", { view: "cost-warnings" }) }
            ]} />
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.customers} id="customers">
          <ChartPanel title="Customer activity" subtitle="New and returning customer signals from the selected period." href={drill("/dashboard/user")}>
            <BarChart items={[
              { label: "New today", value: data.customers.newToday, color: COLORS.green, href: drill("/dashboard/user", { joined: "today" }) },
              { label: "New this month", value: data.customers.newThisMonth, color: COLORS.blue, href: drill("/dashboard/user", { joined: "thisMonth" }) },
              { label: "Returning customers", value: data.customers.returningCustomers, color: COLORS.violet, href: drill("/dashboard/user", { segment: "returning" }) },
              { label: "Customers with open tickets", value: data.customers.customersWithOpenTickets, color: COLORS.amber, href: drill("/dashboard/tikects", { status: "open" }) }
            ]} />
            <div className={styles.insightRow}><InlineInsight label="Total customers" value={number(data.customers.totalCustomers)} /></div>
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.support} id="support">
          <ChartPanel title="Support queue" subtitle="Open ticket workload and priority signals." href={drill("/dashboard/tikects", { status: "open" })}>
            <BarChart items={[
              { label: "Open tickets", value: data.support.openTickets, color: COLORS.blue, href: drill("/dashboard/tikects", { status: "open" }) },
              { label: "Urgent or critical", value: data.support.urgentTickets, color: COLORS.rose, href: drill("/dashboard/tikects", { priority: "Urgent" }) },
              { label: "Unassigned", value: data.support.unassignedTickets, color: COLORS.amber, href: drill("/dashboard/tikects", { assigned: "none" }) }
            ]} />
            <div className={styles.insightRow}><InlineInsight label="Average resolution" value={`${number(data.support.averageResolutionHours, 1)} hr`} tone="green" /></div>
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.marketing} id="marketing">
          <ChartPanel title="Campaign economics" subtitle="Attributed revenue against active campaign budget." href={drill("/dashboard/marketing", { view: "revenue" })}>
            <BarChart items={[
              { label: "Attributed revenue", value: data.marketing.revenue, display: money(data.marketing.revenue, currency), color: COLORS.green, href: drill("/dashboard/marketing", { view: "revenue" }) },
              { label: "Active campaign budget", value: data.marketing.budget, display: money(data.marketing.budget, currency), color: COLORS.amber, href: drill("/dashboard/marketing", { view: "budget" }) }
            ]} />
            <div className={styles.insightRow}>
              <InlineInsight label="Active campaigns" value={number(data.marketing.activeCampaigns)} />
              <InlineInsight label="Attributed orders" value={number(data.marketing.orders)} tone="violet" />
              <InlineInsight label="ROI" value={data.marketing.roiPercent == null ? "-" : `${number(data.marketing.roiPercent, 1)}%`} tone="green" />
            </div>
          </ChartPanel>
        </Section>

        <Section title={SECTION_TITLES.loyalty} id="loyalty">
          <ChartPanel title="Loyalty tier mix" subtitle="Current members by tier." href={drill("/dashboard/loyalty", { view: "members" })}>
            <DonutChart
              items={(data.loyalty.customersByTier || []).map((item, index) => ({
                label: item.tier,
                value: item.customers,
                display: number(item.customers),
                color: [COLORS.blue, COLORS.violet, COLORS.amber, COLORS.green, COLORS.rose][index % 5],
                href: drill("/dashboard/loyalty", { tier: item.tier })
              }))}
              centerValue={number(data.loyalty.activeMembers)}
              centerLabel="active members"
            />
          </ChartPanel>
          <ChartPanel title="Points movement" subtitle="Issued and redeemed in the selected period." href={drill("/dashboard/loyalty")}>
            <BarChart items={[
              { label: "Points issued", value: data.loyalty.pointsIssued, color: COLORS.green, href: drill("/dashboard/loyalty", { transactionType: "Earn" }) },
              { label: "Points redeemed", value: data.loyalty.pointsRedeemed, color: COLORS.violet, href: drill("/dashboard/loyalty", { transactionType: "Redeem" }) }
            ]} />
            <div className={styles.insightRow}><InlineInsight label="Active members" value={number(data.loyalty.activeMembers)} /></div>
          </ChartPanel>
        </Section>

        <section className={styles.detailGrid}>
          <article className={styles.tablePanel}><h2>Top products</h2>{data.products.topProducts?.length ? <div className={styles.rows}>{data.products.topProducts.map(item => <Link key={item.id} href={drill("/dashboard/products", { product: item.id })}><span><strong>{item.name}</strong><small>{item.sku || "No SKU"} · {number(item.units, 2)} units</small></span><b>{money(item.revenue, currency)}</b></Link>)}</div> : <EmptyRows>No sales match the selected filters.</EmptyRows>}</article>
          <article className={styles.tablePanel}><h2>Top customers</h2>{data.customers.topCustomers?.length ? <div className={styles.rows}>{data.customers.topCustomers.map(item => <Link key={item.id} href={drill("/dashboard/user", { customer: item.id })}><span><strong>{item.displayName}</strong><small>{item.customerNumber} · {number(item.orders)} orders</small></span><b>{money(item.lifetimeValue, currency)}</b></Link>)}</div> : <EmptyRows>No customers match the selected filters.</EmptyRows>}</article>
          <article className={styles.tablePanel}><h2>Recent support tickets</h2>{data.support.recentTickets?.length ? <div className={styles.rows}>{data.support.recentTickets.map(item => <Link key={item.id} href={`/dashboard/tikects?ticket=${item.id}`}><span><strong>{item.subject}</strong><small>{item.ticketNumber} · {item.priority}</small></span><b>{item.status}</b></Link>)}</div> : <EmptyRows>No support tickets found.</EmptyRows>}</article>
          <article className={styles.tablePanel}><h2>Customers by loyalty tier</h2>{data.loyalty.customersByTier?.length ? <div className={styles.rows}>{data.loyalty.customersByTier.map(item => <Link key={item.tier} href={drill("/dashboard/loyalty", { tier: item.tier })}><span><strong>{item.tier}</strong><small>Loyalty members</small></span><b>{number(item.customers)}</b></Link>)}</div> : <EmptyRows>No loyalty accounts found.</EmptyRows>}</article>
        </section>
      </>}
    </main>
  );
}
