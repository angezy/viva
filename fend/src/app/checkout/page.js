"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import CheckoutLayout, { CheckoutAuthPrompt, CheckoutLoading } from "./components/CheckoutLayout";
import { readCheckoutState } from "./components/checkoutState";
import { useCheckoutData } from "./components/useCheckoutData";

function shippingText(shipping) {
  return [shipping.addressLine1, shipping.addressLine2, shipping.city, shipping.region, shipping.postalCode, shipping.country]
    .filter(Boolean)
    .join(", ");
}

export default function CheckoutPage() {
  const { user, items, subtotal, discount, couponCode, loading, error } = useCheckoutData();
  const [checkout, setCheckout] = useState(readCheckoutState());

  useEffect(() => {
    setCheckout(readCheckoutState());
  }, []);

  if (loading) return <CheckoutLoading />;

  return (
    <CheckoutLayout currentStep="overview" items={items} subtotal={subtotal} discount={discount} couponCode={couponCode} shippingMethod={checkout.shipping.method}>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {!user ? (
        <CheckoutAuthPrompt />
      ) : !items.length ? (
        <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Your cart is empty</Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", mb: 2 }}>Add products before starting secure checkout.</Typography>
            <Button component={Link} href="/shop" variant="contained" sx={{ borderRadius: 999 }}>Continue shopping</Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2.5}>
          <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Customer information</Typography>
                  <Typography>{checkout.information.email || user.email || "Email not added"}</Typography>
                  <Typography color="var(--color-text-secondary)">{checkout.information.phone || "Phone not added"}</Typography>
                </Box>
                <Button component={Link} href="/checkout/information" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Edit</Button>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Shipping address</Typography>
                  <Typography>{checkout.shipping.fullName || "Address not added"}</Typography>
                  <Typography color="var(--color-text-secondary)">{shippingText(checkout.shipping) || "Choose a shipping address"}</Typography>
                  <Typography color="primary.light" sx={{ mt: 1 }}>{checkout.shipping.method === "express" ? "Express shipping" : "Standard shipping"}</Typography>
                </Box>
                <Button component={Link} href="/checkout/shipping" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Edit</Button>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Payment</Typography>
                  <Typography sx={{ textTransform: "capitalize" }}>{checkout.payment.method || "Card"}</Typography>
                  <Typography color="var(--color-text-secondary)">Secure provider confirmation is required before placing the order.</Typography>
                </Box>
                <Button component={Link} href="/checkout/payment" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Edit</Button>
              </Stack>
            </CardContent>
          </Card>

          <Alert severity="info">Your order details are saved on this device while you move through checkout.</Alert>
          <Button component={Link} href="/checkout/information" variant="contained" size="large" sx={{ borderRadius: 999, py: 1.4, fontWeight: 800 }}>
            Continue to information
          </Button>
        </Stack>
      )}
    </CheckoutLayout>
  );
}
