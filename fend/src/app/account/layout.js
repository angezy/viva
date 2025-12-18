import React from "react";
import styles from "./account.module.css";

const navLinks = [
  { label: "Overview", href: "/account" },
  { label: "Profile", href: "/account/profile" },
  { label: "Orders", href: "/account/orders" },
  { label: "Settings", href: "/account/settings" },
  { label: "Track order", href: "/tracking" },
  { label: "Shop", href: "/shop" },
];

export default function AccountLayout({ children }) {
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
