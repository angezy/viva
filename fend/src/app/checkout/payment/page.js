"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Card, CardContent, FormControlLabel, Radio, Stack, Typography } from "@mui/material";
import { Country, State } from "country-state-city";
import CheckoutLayout, { CheckoutAuthPrompt, CheckoutLoading } from "../components/CheckoutLayout";
import { isInformationComplete, isShippingComplete, readCheckoutState, shippingCost, updateCheckoutState } from "../components/checkoutState";
import { useCheckoutData } from "../components/useCheckoutData";
import { createPayment } from "../../lib/apiClient";
import { toast } from "../../lib/notifications";

const paymentOptions = [
  { value: "card", label: "Card and eligible wallets", detail: "Secure Stripe-hosted checkout" },
];

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const { user, items, subtotal, discount, couponCode, loading, error: cartError } = useCheckoutData();
  const [checkout, setCheckout] = useState(readCheckoutState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCheckout(readCheckoutState()), []);

  useEffect(() => {
    const state = readCheckoutState();
    if (!isInformationComplete(state)) {
      router.replace("/checkout/information");
    } else if (!isShippingComplete(state)) {
      router.replace("/checkout/shipping");
    }
  }, [router]);

  const countryName = useMemo(() => Country.getCountryByCode(checkout.shipping.country)?.name || checkout.shipping.country, [checkout.shipping.country]);
  const regionName = useMemo(() => State.getStateByCodeAndCountry(checkout.shipping.region, checkout.shipping.country)?.name || checkout.shipping.region, [checkout.shipping.region, checkout.shipping.country]);

  function selectPayment(method) {
    const next = { ...checkout, payment: { ...checkout.payment, method } };
    setCheckout(next);
    updateCheckoutState({ payment: next.payment });
  }

  async function handlePlaceOrder() {
    setError("");
    if (!checkout.information.email || !checkout.information.phone) {
      setError("Complete customer information before placing your order.");
      toast.warning("Information required", { description: "Complete customer information before placing your order." });
      return;
    }
    if (!checkout.shipping.fullName || !checkout.shipping.addressLine1 || !checkout.shipping.country || !checkout.shipping.region || !checkout.shipping.city || !checkout.shipping.postalCode) {
      setError("Complete shipping information before placing your order.");
      toast.warning("Shipping information required", { description: "Complete shipping information before placing your order." });
      return;
    }
    setSubmitting(true);
    try {
      const total = Math.max(0, subtotal + shippingCost(checkout.shipping.method) - discount);
      const payment = await createPayment({ amount: total, currency: "USD", method: "card", customerEmail: checkout.information.email, shippingMethod: checkout.shipping.method, couponCode });
      const checkoutUrl = payment.payment?.checkoutUrl || payment.checkoutUrl;
      if (!checkoutUrl) throw new Error("Secure payment checkout is unavailable");
      window.location.assign(checkoutUrl);
    } catch (submitError) {
      if (submitError.message === "unauthorized") {
        setError("Your session expired. Please sign in before placing the order.");
        toast.error("Session expired", { description: "Please sign in before placing the order." });
      } else {
        setError(submitError.message || "Payment could not be completed.");
        toast.error("Checkout error", { description: submitError.message || "Payment could not be completed." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CheckoutLoading />;
  if (!user) {
    return <CheckoutLayout currentStep="payment" items={items} subtotal={subtotal} discount={discount} couponCode={couponCode} shippingMethod={checkout.shipping.method}><CheckoutAuthPrompt /></CheckoutLayout>;
  }

  return (
    <CheckoutLayout currentStep="payment" items={items} subtotal={subtotal} discount={discount} couponCode={couponCode} shippingMethod={checkout.shipping.method}>
      {(cartError || error) && <Alert severity="error" sx={{ mb: 3 }}>{error || cartError}</Alert>}
      <Stack spacing={2.5}>
        <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Payment method</Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", mb: 3 }}>You will complete payment on Stripe&apos;s secure hosted checkout page. Raw card numbers are never sent to Weluxo.</Typography>
            <Stack spacing={1.5}>
              {paymentOptions.map((option) => {
                const selected = checkout.payment.method === option.value;
                return (
                  <Card key={option.value} onClick={() => selectPayment(option.value)} sx={{ cursor: "pointer", bgcolor: selected ? "var(--color-primary-soft)" : "var(--color-surface-muted)", color: "var(--color-text-primary)", border: selected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <FormControlLabel control={<Radio checked={selected} onChange={() => selectPayment(option.value)} />} label={<Box><Typography sx={{ fontWeight: 800 }}>{option.label}</Typography><Typography variant="body2" color="var(--color-text-secondary)">{option.detail}</Typography></Box>} />
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
            <Alert severity="info" sx={{ mt: 3 }}>Stripe Checkout will collect payment details directly and return you here after the provider confirms payment.</Alert>
          </CardContent>
        </Card>

        <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Billing address</Typography>
            <Typography color="var(--color-text-secondary)">✓ Same as shipping address</Typography>
            <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", mt: 1 }}>{checkout.shipping.fullName}, {checkout.shipping.addressLine1}, {checkout.shipping.city}, {regionName}, {countryName}</Typography>
          </CardContent>
        </Card>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button onClick={handlePlaceOrder} variant="contained" size="large" disabled={submitting} sx={{ borderRadius: 999, py: 1.3, fontWeight: 900 }}>{submitting ? "Processing payment..." : "Place order"}</Button>
          <Button component={Link} href="/checkout/shipping" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Back to shipping</Button>
        </Stack>
        <Alert severity="info">Payment cannot be completed until the server has a configured Stripe secret key and production callback URL.</Alert>
      </Stack>
    </CheckoutLayout>
  );
}
