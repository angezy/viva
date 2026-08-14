"use client";

import { Alert, Stack, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import OrderOutcomeLayout, { OutcomeButton } from "../../components/OrderOutcomeLayout";

export default function CheckoutCancelledOrderPage() {
  const { orderId } = useParams();
  return (
    <OrderOutcomeLayout type="cancelled" eyebrow="Checkout cancelled" title="Your order was not placed" description="No payment was completed. Your cart is still available so you can return whenever you’re ready." orderId={orderId} actions={<><OutcomeButton href="/checkout">Return to checkout</OutcomeButton><OutcomeButton href="/cart" variant="outlined">View cart</OutcomeButton><OutcomeButton href="/shop" variant="outlined">Keep shopping</OutcomeButton></>}>
      <Stack spacing={2}><Alert severity="warning">Your products and quantities remain saved in your cart.</Alert><Typography textAlign="center" color="rgba(255,255,255,0.62)">Need help? <a href="/contact" style={{ color: "inherit" }}>Contact Weluxo support</a>.</Typography></Stack>
    </OrderOutcomeLayout>
  );
}
