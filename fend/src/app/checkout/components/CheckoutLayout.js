"use client";

import Link from "next/link";
import { Box, Button, Card, CardContent, CardMedia, Container, Divider, Grid, Stack, Typography } from "@mui/material";
import { canAccessCheckoutStep, readCheckoutState, shippingCost, shippingLabel } from "./checkoutState";

export const CHECKOUT_STEPS = [
  { key: "overview", label: "Checkout", href: "/checkout" },
  { key: "information", label: "Information", href: "/checkout/information" },
  { key: "shipping", label: "Shipping", href: "/checkout/shipping" },
  { key: "payment", label: "Payment", href: "/checkout/payment" },
  { key: "confirmation", label: "Confirmation", href: "/checkout/success" },
];

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function CheckoutLayout({ currentStep, children, items = [], subtotal = 0, discount = null, couponCode = "", shippingMethod = "standard" }) {
  const shipping = shippingCost(shippingMethod);
  const tax = 0;
  const checkoutState = readCheckoutState();
  const appliedDiscount = discount == null ? Number(checkoutState.coupon?.discount) || 0 : Math.max(0, Number(discount) || 0);
  const appliedCouponCode = couponCode || checkoutState.coupon?.code || "";
  const total = Math.max(0, subtotal + shipping + tax - appliedDiscount);

  return (
    <Box sx={{ minHeight: "100vh", background: "var(--color-background)", color: "var(--color-text-primary)", py: 3 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Link href="/checkout" style={{ color: "var(--color-text-primary)", textDecoration: "none" }}>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.04em" }}>
              Weluxo
            </Typography>
          </Link>
          <Button component={Link} href="/checkout/cancelled/current" variant="text" sx={{ color: "var(--color-text-secondary)" }}>
            Cancel checkout
          </Button>
        </Stack>

        <Card sx={{ mb: 4, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 0 }} justifyContent="space-between">
              {CHECKOUT_STEPS.map((step, index) => {
                const active = step.key === currentStep;
                const complete = CHECKOUT_STEPS.findIndex((item) => item.key === currentStep) > index;
                const accessible = canAccessCheckoutStep(checkoutState, step.key) && step.key !== "confirmation";
                return (
                  <Box key={step.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "50%",
                        bgcolor: active || complete ? "primary.main" : "#f1ece4",
                        color: active || complete ? "#ffffff" : "var(--color-text-secondary)",
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {complete ? "✓" : index + 1}
                    </Box>
                    <Typography
                      component={accessible ? Link : "span"}
                      href={accessible ? step.href : undefined}
                      onClick={(event) => {
                        if (!accessible) event.preventDefault();
                      }}
                      sx={{
                        color: active ? "var(--color-text-primary)" : accessible ? "var(--color-text-secondary)" : "#a0a2a5",
                        fontWeight: active ? 800 : 600,
                        textDecoration: "none",
                        cursor: accessible ? "pointer" : "not-allowed",
                      }}
                      aria-current={active ? "step" : undefined}
                      aria-disabled={!accessible}
                    >
                      {step.label}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} md={7} sx={{ minWidth: 0, width: "100%" }}>
            {children}
          </Grid>
          <Grid item xs={12} md={5} sx={{ minWidth: 0, width: "100%" }}>
            <Card sx={{ width: "100%", minWidth: 0, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", position: { md: "sticky" }, top: { md: 24 } }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                  Order summary
                </Typography>
                <Stack spacing={1.5}>
                  {items.length ? items.map((item) => (
                    <Stack direction="row" spacing={1.5} alignItems="center" key={item.productId}>
                      <CardMedia component="img" image={item.image || "https://placehold.co/72x72?text=Item"} alt={item.title || "Product"} sx={{ width: 60, height: 60, borderRadius: 2, objectFit: "cover" }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700 }}>{item.title || "Product"}</Typography>
                        <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>Qty {item.quantity}</Typography>
                      </Box>
                      <Typography>{money(Number(item.price) * Number(item.quantity))}</Typography>
                    </Stack>
                  )) : <Typography color="var(--color-text-secondary)">Your cart is empty.</Typography>}
                </Stack>
                <Divider sx={{ borderColor: "var(--color-border)", my: 2 }} />
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}><Typography color="var(--color-text-secondary)">Subtotal</Typography><Typography>{money(subtotal)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}><Typography color="var(--color-text-secondary)">{shippingLabel(shippingMethod)}</Typography><Typography>{shipping ? money(shipping) : "Free"}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}><Typography color="var(--color-text-secondary)">Tax</Typography><Typography>{tax ? money(tax) : "Calculated later"}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}><Typography color="var(--color-text-secondary)">Discount {appliedCouponCode && `(${appliedCouponCode})`}</Typography><Typography>{appliedDiscount ? `-${money(appliedDiscount)}` : "—"}</Typography></Stack>
                <Divider sx={{ borderColor: "var(--color-border)", mb: 2 }} />
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Total</Typography><Typography variant="h6" sx={{ fontWeight: 900 }}>{money(total)}</Typography></Stack>
                <Button component={Link} href="/cart" fullWidth sx={{ mt: 2, color: "var(--color-primary)" }}>Return to cart</Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 4, color: "var(--color-text-secondary)" }}>
          <Typography variant="body2">Need help? <Link href="/contact" style={{ color: "inherit" }}>Contact support</Link></Typography>
          <Link href="/shipping-policy" style={{ color: "inherit", fontSize: 14 }}>Shipping policy</Link>
          <Link href="/return-refund-policy" style={{ color: "inherit", fontSize: 14 }}>Returns</Link>
          <Link href="/payment-security" style={{ color: "inherit", fontSize: 14 }}>Payment security</Link>
        </Stack>
      </Container>
    </Box>
  );
}

export function CheckoutLoading() {
  return <Container sx={{ py: 8, color: "var(--color-text-primary)" }}><Typography>Loading checkout...</Typography></Container>;
}

export function CheckoutAuthPrompt() {
  return (
    <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Sign in to continue</Typography>
        <Typography sx={{ color: "var(--color-text-secondary)", mb: 2 }}>Your cart and order need to be linked to a secure customer session.</Typography>
        <Stack direction="row" spacing={1.5}><Button component={Link} href="/signin" variant="contained" sx={{ borderRadius: 999 }}>Sign in</Button><Button component={Link} href="/cart" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Return to cart</Button></Stack>
      </CardContent>
    </Card>
  );
}
