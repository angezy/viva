import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_COOKIE_NAME, verifyToken } from "../lib/auth";
import AccountNav from "./AccountNav";
import styles from "./account.module.css";

const navLinks = [
  { label: "Overview", href: "/account", index: "01" },
  { label: "Orders", href: "/account/orders", index: "02" },
  { label: "Saved products", href: "/account/saved", index: "03" },
  { label: "Profile", href: "/account/profile", index: "04" },
  { label: "Addresses", href: "/account/addresses", index: "05" },
  { label: "Settings & security", href: "/account/settings", index: "06" },
  { label: "Support", href: "/account/support", index: "07" },
  { label: "Track an order", href: "/account/tracking", index: "08" },
];

export default async function AccountLayout({ children }) {
  const token = (await cookies()).get(CUSTOMER_COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || ["admin", "owner"].includes(String(user.role || "").toLowerCase())) redirect("/signin");

  return (
    <div className={styles.page}>
      <div className={styles.accountHeader}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><span>My account</span>
        </nav>
        <div className={styles.accountHeaderRow}>
          <div>
            <p className={styles.eyebrow}>CUSTOMER ACCOUNT</p>
            <h1>My account</h1>
            <p>Manage your orders, profile, and saved products.</p>
          </div>
          <Link className={styles.shopLink} href="/shop">Continue shopping <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <div className={styles.main}>
        <aside className={styles.sidebar} aria-label="Account navigation">
          <div className={styles.sidebarTitle}>Account menu</div>
          <AccountNav links={navLinks} />
          <div className={styles.sidebarNote}>
            <span>Need help?</span>
          <Link href="/help-center">Visit the help center</Link>
          </div>
        </aside>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
