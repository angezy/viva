"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import CheckoutLayout, { CheckoutLoading } from "../components/CheckoutLayout";
import { readCheckoutState, updateCheckoutState } from "../components/checkoutState";
import { useCheckoutData } from "../components/useCheckoutData";
import { toast } from "../../lib/notifications";

const fieldSx = {
  "& .MuiOutlinedInput-root": { color: "white", backgroundColor: "rgba(255,255,255,0.04)" },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.72)" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.38)" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#60a5fa" },
};

export default function CheckoutInformationPage() {
  const { user, items, subtotal, loading, error: cartError } = useCheckoutData();
  const [form, setForm] = useState(readCheckoutState().information);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = readCheckoutState().information;
    setForm((current) => ({ ...saved, email: saved.email || user?.email || current.email }));
  }, [user]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.email.trim() || !form.phone.trim()) {
      setError("Enter an email address and contact phone to continue.");
      toast.warning("Information required", { description: "Enter an email address and contact phone to continue." });
      return;
    }
    updateCheckoutState({ information: { ...form, email: form.email.trim(), phone: form.phone.trim() } });
    window.location.href = "/checkout/shipping";
  }

  if (loading) return <CheckoutLoading />;

  return (
    <CheckoutLayout currentStep="information" items={items} subtotal={subtotal} shippingMethod={readCheckoutState().shipping.method}>
      {(cartError || error) && <Alert severity="error" sx={{ mb: 3 }}>{error || cartError}</Alert>}
      <Card sx={{ bgcolor: "#0f172a", color: "white", border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Customer information</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.68)", mb: 3 }}>We’ll use these details for order updates and delivery questions.</Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField label="Email address" type="email" value={form.email} onChange={update("email")} required fullWidth autoComplete="email" sx={fieldSx} />
              <TextField label="Contact phone" type="tel" value={form.phone} onChange={update("phone")} required fullWidth autoComplete="tel" sx={fieldSx} />
              <FormControlLabel control={<Checkbox checked={Boolean(form.subscribe)} onChange={(event) => setForm((current) => ({ ...current, subscribe: event.target.checked }))} />} label="Subscribe to Weluxo offers" />
              {user?.guest && (
                <Alert severity="info">Guest checkout is available. <Link href="/signin" style={{ color: "inherit", fontWeight: 700 }}>Sign in</Link> to use your account order history and saved details.</Alert>
              )}
              <Button type="submit" variant="contained" size="large" sx={{ borderRadius: 999, py: 1.3, fontWeight: 800 }}>Continue to shipping</Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </CheckoutLayout>
  );
}
