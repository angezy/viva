"use client";

import { useEffect, useState } from "react";
import { fetchAccountDetails, fetchCart, fetchSession } from "../../lib/apiClient";
import { hydrateCheckoutFromAccount, readCheckoutState, updateCheckoutState } from "./checkoutState";

export function useCheckoutData() {
  const [data, setData] = useState({ user: null, items: [], subtotal: 0, discount: 0, couponCode: "", loading: true, error: "" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [session, cart] = await Promise.all([fetchSession(), fetchCart()]);
        const accountDetails = session?.user && !session.user.guest
          ? await fetchAccountDetails().catch(() => null)
          : null;
        const checkout = hydrateCheckoutFromAccount(readCheckoutState(), session?.user, accountDetails);
        if (session?.user && !session.user.guest) {
          updateCheckoutState({ information: checkout.information, shipping: checkout.shipping });
        }
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
