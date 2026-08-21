"use client";

import { Alert, Box, Stack, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import OrderOutcomeLayout, { OutcomeButton } from "../../components/OrderOutcomeLayout";

export default function CheckoutFailedOrderPage() {
  const { orderId } = useParams();
  return (
    <OrderOutcomeLayout type="failed" eyebrow="Payment failed" title="We couldn’t complete your payment" description="Your products and quantities are still saved. Try again or choose another payment method." orderId={orderId} actions={<><OutcomeButton href="/checkout/payment?retry=true">Retry payment</OutcomeButton><OutcomeButton href="/checkout/payment?method=paypal" variant="outlined">Try PayPal</OutcomeButton><OutcomeButton href="/cart" variant="outlined">View cart</OutcomeButton></>}>
      <Stack spacing={2.5}>
        <Alert severity="error">Payment was not confirmed. No completed order was created.</Alert>
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Possible reason</Typography>
          <Typography color="var(--color-text-secondary)">The payment provider may have declined the method, required additional verification, or encountered a network error.</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Need assistance?</Typography>
          <Typography color="var(--color-text-secondary)">Contact Weluxo support and include reference #{orderId} so we can help.</Typography>
        </Box>
      </Stack>
    </OrderOutcomeLayout>
  );
}
