"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./account.module.css";

export default function AccountNav({ links }) {
  const pathname = usePathname();

  return (
    <ul className={styles.sidebarList}>
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/account" && pathname.startsWith(`${link.href}/`));
        return (
          <li key={link.href}>
            <Link className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`} href={link.href} aria-current={active ? "page" : undefined}>
              <span className={styles.navIndex} aria-hidden="true">{link.index}</span>
              <span>{link.label}</span>
              <span className={styles.navArrow} aria-hidden="true">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
