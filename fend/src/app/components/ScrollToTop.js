"use client";

import { useCallback, useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();

  const resetScroll = useCallback(() => {
    if (window.location.hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    // Browser history restoration can run after the first scroll reset.
    // Repeat after the route and restored document have had a chance to paint.
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
    window.setTimeout(() => window.scrollTo(0, 0), 80);
    window.setTimeout(() => window.scrollTo(0, 0), 250);
    window.setTimeout(() => window.scrollTo(0, 0), 500);
  }, []);

  useLayoutEffect(() => {
    resetScroll();
  }, [pathname, resetScroll]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handlePopState = () => resetScroll();
    const handlePageShow = () => resetScroll();
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [resetScroll]);

  return null;
}
