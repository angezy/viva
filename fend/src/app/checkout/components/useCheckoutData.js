"use client";

import { useEffect, useState } from "react";
import { fetchCart, fetchSession } from "../../lib/apiClient";

export function useCheckoutData() {
  const [data, setData] = useState({ user: null, items: [], subtotal: 0, discount: 0, couponCode: "", loading: true, error: "" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = await fetchSession();
        const cart = await fetchCart();
        if (active) {
          setData({
            user: session?.user || { id: "guest", guest: true },
            items: cart.items || [],
            subtotal: Number(cart.subtotal) || 0,
            discount: Number(cart.discount) || 0,
            couponCode: cart.coupon?.code || "",
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setData({
            user: null,
            items: [],
            subtotal: 0,
            discount: 0,
            couponCode: "",
            loading: false,
            error: error.message || "Unable to load your cart.",
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return data;
}
