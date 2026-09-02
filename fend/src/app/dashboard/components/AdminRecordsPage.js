"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./adminRecords.module.css";
import { TablePageSkeleton } from "../../components/LoadingSkeletons";

function display(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
  if (typeof value === "number") return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

export default function AdminRecordsPage({ area, title }) {
  const [state, setState] = useState({ loading: true, error: "", errorCode: "", missingObjects: [], data: null });
  useEffect(() => {
    const query = typeof window === "undefined" ? "" : window.location.search;
    fetch(`/api/admin/records/${area}${query}`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(body.error || "Request failed");
          error.code = body.code || "";
          error.missingObjects = body.missingObjects || [];
          throw error;
        }
        return body;
      })
      .then(data => setState({ loading: false, error: "", errorCode: "", missingObjects: [], data }))
      .catch(error => setState({ loading: false, error: error.message, errorCode: error.code || "", missingObjects: error.missingObjects || [], data: null }));
  }, [area]);

  if (state.loading) return <TablePageSkeleton />;

  const rows = state.data?.rows || [];
  const keys = rows.length ? Object.keys(rows[0]).filter(key => key !== "Id") : [];
  return <main className={styles.page}>
    <div className={styles.header}><div><Link href="/dashboard/Overview">← Overview</Link><h1>{state.data?.title || title}</h1><p>Database records matching the filters selected on the Overview dashboard.</p></div></div>
    {state.error && <div className={`${styles.message} ${styles.error}`}>
      <strong>{state.errorCode === "CANONICAL_SCHEMA_NOT_READY" ? "Database upgrade required" : "Unable to load records"}</strong>
      <span>{state.error}</span>
      {state.missingObjects.length > 0 && <small>Missing objects: {state.missingObjects.join(", ")}</small>}
    </div>}
    {!state.loading && !state.error && <div className={styles.tableWrap}>{rows.length ? <table><thead><tr>{keys.map((key, index) => <th key={key}>{state.data.columns?.[index] || key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.Id || index}>{keys.map(key => <td key={key}>{display(row[key])}</td>)}</tr>)}</tbody></table> : <div className={styles.message}>No records match these filters.</div>}</div>}
    {rows.length > 0 && <p className={styles.caption}>Showing up to {state.data.limit} records. Internal IDs and sensitive customer/payment fields are intentionally hidden.</p>}
  </main>;
}
