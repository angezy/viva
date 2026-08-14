"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import { confirmPayment, createOrder } from "../../lib/apiClient";
import { clearCheckoutState, isInformationComplete, isShippingComplete, readCheckoutState, shippingCost } from "../components/checkoutState";

export default function CheckoutReturnPage() {
  const router = useRouter();
  const finalized = useRef(false);
  const [status, setStatus] = useState("pending");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const providerStatus = query.get("status") || "pending";
    const sessionId = query.get("session_id") || "";
    setReference(sessionId || query.get("orderId") || "");

    const isCanceled = ["cancel", "canceled", "cancelled"].includes(providerStatus);
    const isSuccessful = ["success", "succeeded"].includes(providerStatus);
    setStatus(isCanceled ? "cancelled" : isSuccessful ? "processing" : "pending");

    if (!isSuccessful || !sessionId || finalized.current) return undefined;
    finalized.current = true;

    async function finalizeOrder() {
      const checkout = readCheckoutState();
      if (!isInformationComplete(checkout) || !isShippingComplete(checkout)) {
        setStatus("failed");
        setError("Your checkout details are incomplete. The payment was not attached to an order.");
        return;
      }

      try {
        await confirmPayment({ paymentId: sessionId });
        const shipping = checkout.shipping;
        const result = await createOrder({
          paymentId: sessionId,
          paymentMethod: "card",
          customer: checkout.information,
          shippingMethod: shipping.method,
          shippingAddress: {
            ...shipping,
            email: checkout.information.email,
            phone: checkout.information.phone,
            shippingMethod: shipping.method,
          },
          shippingCost: shippingCost(shipping.method),
        });
        const orderId = result.order?.id || result.orderId;
        if (!orderId) throw new Error("The payment succeeded but no order number was returned.");
        clearCheckoutState();
        router.replace(`/checkout/success/${encodeURIComponent(orderId)}`);
      } catch (finalizeError) {
        setStatus("failed");
        setError(finalizeError.message || "We could not verify the payment and create your order.");
      }
    }

    finalizeOrder();
    return undefined;
  }, [router]);

  const isCanceled = status === "cancelled";
  const isProcessing = status === "processing";
  const isFailed = status === "failed";

  return (
    <Box sx={{ backgroundColor: "#050714", minHeight: "100vh", color: "white", py: 8 }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 4, bgcolor: "#0f172a", color: "white" }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="overline" sx={{ color: isCanceled ? "warning.light" : isFailed ? "error.light" : isProcessing ? "primary.light" : "success.light", letterSpacing: 3 }}>
              Payment return
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
              {isCanceled ? "Payment canceled" : isProcessing ? "Verifying your payment" : isFailed ? "We could not complete your order" : "Payment returned successfully"}
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.72)", mb: 3 }}>
              {isCanceled
                ? "No order was placed. Your cart and checkout details are still available."
                : isProcessing
                ? "We are confirming the payment with Stripe before creating your order."
                : isFailed
                ? "Your payment needs attention. Do not retry if your bank shows a completed charge until support verifies it."
                : "Review your checkout status before continuing."}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {reference && <Typography variant="body2" sx={{ mb: 3, color: "rgba(255,255,255,0.55)", wordBreak: "break-all" }}>Reference: {reference}</Typography>}
            {!isProcessing && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button component={Link} href={isCanceled || isFailed ? "/checkout/payment" : "/checkout"} variant="contained" sx={{ borderRadius: 999 }}>
                  {isCanceled ? "Return to checkout" : isFailed ? "Try payment again" : "Continue"}
                </Button>
                <Button component={Link} href="/cart" variant="outlined" sx={{ color: "white", borderColor: "rgba(255,255,255,0.3)", borderRadius: 999 }}>
                  View cart
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
