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
        <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.04)" }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Possible reason</Typography>
          <Typography color="rgba(255,255,255,0.7)">The payment provider may have declined the method, required additional verification, or encountered a network error.</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Need assistance?</Typography>
          <Typography color="rgba(255,255,255,0.68)">Contact Weluxo support and include reference #{orderId} so we can help.</Typography>
        </Box>
      </Stack>
    </OrderOutcomeLayout>
  );
}
