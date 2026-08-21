import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_COOKIE_NAME, verifyToken } from "../lib/auth";
import styles from "./account.module.css";

const navLinks = [
  { label: "Overview", href: "/account" },
  { label: "Profile", href: "/account/profile" },
  { label: "Orders", href: "/account/orders" },
  { label: "Saved products", href: "/account/saved" },
  { label: "Support", href: "/account/support" },
  { label: "Settings", href: "/account/settings" },
  { label: "Track order", href: "/account/tracking" },
  { label: "Shop", href: "/shop" },
];

export default async function AccountLayout({ children }) {
  const token = (await cookies()).get(CUSTOMER_COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || String(user.role || "").toLowerCase() === "admin") redirect("/signin");

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Pages</div>
          <ul className={styles.sidebarList}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a className={styles.sidebarLink} href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
