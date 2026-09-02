"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Divider, Stack, Typography } from "@mui/material";
import OrderOutcomeLayout, { OutcomeButton } from "../../components/OrderOutcomeLayout";
import { fetchOrderById } from "../../../lib/apiClient";
import { hasConsent } from "../../../lib/cookies";
import { useParams } from "next/navigation";

export default function CheckoutSuccessOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const tracked = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await fetchOrderById(orderId);
        if (!result?.order) throw new Error("Order not found");
        if (active) setOrder(result.order);
      } catch (loadError) {
        if (active) setError(loadError.message || "Order details are still processing.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (orderId) load();
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    if (!order || tracked.current) return;
    tracked.current = true;
    const purchase = { transaction_id: order.id, value: Number(order.total || 0), currency: "USD", items: order.items || [] };
    if (hasConsent("analytics")) window.gtag?.("event", "purchase", purchase);
    if (hasConsent("marketing")) {
      window.fbq?.("track", "Purchase", { value: purchase.value, currency: purchase.currency });
      window.ttq?.track?.("CompletePayment", purchase);
    }
  }, [order]);

  if (loading) {
    return <OrderOutcomeLayout type="cancelled" eyebrow="Order confirmation" title="Verifying your order" description="We are checking the order record before showing confirmation details." actions={<OutcomeButton href="/checkout">Return to checkout</OutcomeButton>} />;
  }

  if (error || !order) {
    return (
      <OrderOutcomeLayout type="cancelled" eyebrow="Order not verified" title="We couldn’t verify this order" description="This confirmation page only becomes available after a paid checkout creates an order." actions={<><OutcomeButton href="/checkout">Return to checkout</OutcomeButton><OutcomeButton href="/cart" variant="outlined">View cart</OutcomeButton></>}>
        <Alert severity="warning">No completed paid order was found for this confirmation link.</Alert>
      </OrderOutcomeLayout>
    );
  }

  const shipping = order?.shippingAddress || {};
  const arrival = shipping.shippingWindow || "See tracking for the latest delivery estimate";

  return (
    <OrderOutcomeLayout type="success" eyebrow="Order confirmed" title="Thank you for your order!" description="Your order has been successfully placed. We’ll keep you updated as it moves through processing and delivery." orderId={orderId} actions={<><OutcomeButton href="/tracking">Track my order</OutcomeButton><OutcomeButton href="/shop" variant="outlined">Continue shopping</OutcomeButton></>}>
      {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2.5}>
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Customer email</Typography>
          <Typography>{shipping.email || "Your confirmation details are available in your account."}</Typography>
          <Typography variant="body2" color="var(--color-text-secondary)">A confirmation email will be sent when email delivery is connected.</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Order summary</Typography>
          <Stack spacing={1}>
            {(order?.items || []).map((item, index) => (
              <Stack direction="row" justifyContent="space-between" key={`${item.title}-${index}`}>
                <Typography>{item.quantity} × {item.title}</Typography>
                <Typography>${Number(item.price || 0).toFixed(2)}</Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ borderColor: "var(--color-border)", my: 2 }} />
          <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Total paid</Typography><Typography sx={{ fontWeight: 900 }}>${Number(order?.total || 0).toFixed(2)}</Typography></Stack>
        </Box>
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Delivery information</Typography>
          <Typography color="var(--color-primary)">Estimated arrival: {arrival}</Typography>
          <Typography sx={{ mt: 1 }}>{shipping.fullName}</Typography>
          <Typography color="var(--color-text-secondary)">{[shipping.addressLine1, shipping.addressLine2, shipping.city, shipping.region, shipping.postalCode, shipping.country].filter(Boolean).join(", ") || "Shipping details are processing."}</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>What happens next?</Typography>
          <Stack spacing={0.75} color="var(--color-text-secondary)">
            <Typography>✓ Order confirmed</Typography><Typography>✓ Supplier processing</Typography><Typography>✓ Shipping tracking created</Typography><Typography>✓ Delivery</Typography>
          </Stack>
        </Box>
        <Typography variant="body2" textAlign="center" color="var(--color-text-secondary)">Need help? <a href="/contact" style={{ color: "inherit" }}>Contact Weluxo support</a> · <a href={`/invoice/${encodeURIComponent(orderId)}`} style={{ color: "inherit" }}>View invoice</a></Typography>
      </Stack>
    </OrderOutcomeLayout>
  );
}
