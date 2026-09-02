"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Card, CardContent, CircularProgress, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { Country, State } from "country-state-city";
import CheckoutLayout, { CheckoutLoading } from "../components/CheckoutLayout";
import { isInformationComplete, readCheckoutState, updateCheckoutState } from "../components/checkoutState";
import { useCheckoutData } from "../components/useCheckoutData";
import { estimateCartShipping, saveCheckoutDetails } from "../../lib/apiClient";
import { toast } from "../../lib/notifications";

const fieldSx = {
  "& .MuiOutlinedInput-root": { color: "var(--color-text-primary)", backgroundColor: "#ffffff" },
  "& .MuiInputLabel-root": { color: "var(--color-text-secondary)" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-border)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-primary)" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#60a5fa" },
  "& .MuiSelect-select": { display: "block", width: "100%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
};
const menuProps = { PaperProps: { sx: { maxHeight: 320, bgcolor: "#ffffff", color: "var(--color-text-primary)", "& .MuiMenuItem-root:hover": { bgcolor: "var(--color-primary-soft)" }, "& .Mui-selected": { bgcolor: "var(--color-primary-soft) !important" } } } };

function normalizeShippingSelection(shipping) {
  return String(shipping?.logisticName || shipping?.method || "").trim();
}

export default function CheckoutShippingPage() {
  const router = useRouter();
  const { user, items, subtotal, discount, couponCode, loading, error: cartError } = useCheckoutData();
  const [form, setForm] = useState(readCheckoutState().shipping);
  const [shippingOptions, setShippingOptions] = useState(() => {
    const saved = readCheckoutState().shipping;
    return saved?.logisticName ? [saved] : [];
  });
  const [shippingLoading, setShippingLoading] = useState(false);
  const [error, setError] = useState("");
  const countryOptions = useMemo(() => Country.getAllCountries().map((country) => ({ code: country.isoCode, label: country.name })).sort((a, b) => a.label.localeCompare(b.label)), []);
  const stateOptions = useMemo(
    () => form.country ? State.getStatesOfCountry(form.country).map((region) => ({ code: region.isoCode, label: region.name })).sort((a, b) => a.label.localeCompare(b.label)) : [],
    [form.country]
  );

  useEffect(() => {
    if (!isInformationComplete(readCheckoutState())) {
      router.replace("/checkout/information");
      return;
    }
    queueMicrotask(() => setForm(readCheckoutState().shipping));
  }, [router]);

  const clearShippingSelection = (current) => ({ ...current, method: "", logisticName: "", label: "", window: "", cost: null, fromCountryCode: "" });
  const update = (field) => (event) => {
    if (field === "postalCode") setShippingOptions([]);
    setForm((current) => {
      const next = { ...current, [field]: event.target.value };
      return field === "postalCode" ? clearShippingSelection(next) : next;
    });
  };
  const changeCountry = (event) => {
    setShippingOptions([]);
    setForm((current) => clearShippingSelection({ ...current, country: event.target.value, region: "" }));
  };

  async function loadShippingOptions() {
    if (!String(form.country || "").trim() || !String(form.postalCode || "").trim()) {
      throw new Error("Choose a country and enter a ZIP / postal code first.");
    }
    setShippingLoading(true);
    setError("");
    try {
      const result = await estimateCartShipping({
        country: form.country,
        postalCode: form.postalCode,
        method: form.logisticName || form.method,
      });
      const options = Array.isArray(result.estimates) ? result.estimates : [];
      const selected = options.find((option) => option.logisticName === form.logisticName || option.method === form.method)
        || result.selected
        || options[0];
      if (!selected) throw new Error("No shipping service is available for this cart and address.");
      setShippingOptions(options);
      const shipping = {
        ...form,
        method: selected.logisticName || selected.method,
        logisticName: selected.logisticName || selected.method,
        label: selected.label || selected.logisticName || selected.method,
        window: selected.window || "",
        cost: Number(selected.cost) || 0,
        fromCountryCode: selected.fromCountryCode || "",
      };
      setForm(shipping);
      return shipping;
    } finally {
      setShippingLoading(false);
    }
  }

  function selectShippingOption(event) {
    const selected = shippingOptions.find((option) => option.logisticName === event.target.value || option.method === event.target.value);
    if (!selected) return;
    setForm((current) => ({
      ...current,
      method: selected.logisticName || selected.method,
      logisticName: selected.logisticName || selected.method,
      label: selected.label || selected.logisticName || selected.method,
      window: selected.window || "",
      cost: Number(selected.cost) || 0,
      fromCountryCode: selected.fromCountryCode || "",
    }));
  }

  async function handleLoadShippingOptions() {
    try {
      await loadShippingOptions();
    } catch (quoteError) {
      setError(quoteError.message || "Unable to load shipping options.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const required = ["fullName", "addressLine1", "city", "region", "country", "postalCode"];
    if (required.some((field) => !String(form[field] || "").trim())) {
      setError("Complete every required shipping field before continuing.");
      toast.warning("Shipping information required", { description: "Complete every required shipping field before continuing." });
      return;
    }
    let selectedShipping = form;
    if (!normalizeShippingSelection(form) || !shippingOptions.some((option) => (option.logisticName || option.method) === (form.logisticName || form.method))) {
      try {
        selectedShipping = await loadShippingOptions();
      } catch (quoteError) {
        setError(quoteError.message || "Choose an available shipping service before continuing.");
        toast.warning("Shipping service required", { description: quoteError.message || "Choose an available shipping service before continuing." });
        return;
      }
    }
    const checkout = readCheckoutState();
    const shipping = { ...selectedShipping, ownerEmail: checkout.information?.ownerEmail || "" };
    updateCheckoutState({ shipping });
    if (user && !user.guest) {
      try {
        await saveCheckoutDetails({ information: checkout.information, shipping });
      } catch (saveError) {
        setError(saveError.message || "Unable to save your details to your account.");
        toast.error("Details not saved", { description: "Please try again before continuing." });
        return;
      }
    }
    router.push("/checkout/payment");
  }

  if (loading) return <CheckoutLoading />;

  return (
    <CheckoutLayout currentStep="shipping" items={items} subtotal={subtotal} discount={discount} couponCode={couponCode} shippingMethod={form}>
      {(cartError || error) && <Alert severity="error" sx={{ mb: 3 }}>{error || cartError}</Alert>}
      <Card sx={{ width: "100%", minWidth: 0, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
        <CardContent sx={{ p: { xs: 3, md: 4 }, minHeight: { xs: 680, md: 720 }, boxSizing: "border-box" }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Shipping address</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", mb: 3 }}>Choose where you want your Weluxo order delivered.</Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField select label="Country" value={form.country} onChange={changeCountry} required fullWidth sx={fieldSx} SelectProps={{ MenuProps: menuProps }}>
                <MenuItem value="" disabled>Select a country</MenuItem>
                {countryOptions.map((country) => <MenuItem key={country.code} value={country.code}>{country.label}</MenuItem>)}
              </TextField>
              <TextField label="Full name" value={form.fullName} onChange={update("fullName")} required fullWidth autoComplete="shipping name" sx={fieldSx} />
              <TextField label="Street address" value={form.addressLine1} onChange={update("addressLine1")} required fullWidth autoComplete="shipping street-address" sx={fieldSx} />
              <TextField label="Apartment, suite, etc. (optional)" value={form.addressLine2} onChange={update("addressLine2")} fullWidth autoComplete="shipping address-line2" sx={fieldSx} />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, width: "100%" }}>
                <Box sx={{ minWidth: 0, width: "100%" }}><TextField label="City" value={form.city} onChange={update("city")} required fullWidth autoComplete="shipping address-level2" sx={fieldSx} /></Box>
                <Box sx={{ minWidth: 0, width: "100%" }}>
                  {stateOptions.length ? (
                    <TextField select label="State / region" value={form.region} onChange={update("region")} required fullWidth disabled={!form.country} sx={{ ...fieldSx, width: "100%" }} SelectProps={{ MenuProps: menuProps }}>
                      <MenuItem value="" disabled>Select a region</MenuItem>
                      {stateOptions.map((region) => <MenuItem key={region.code} value={region.code}>{region.label}</MenuItem>)}
                    </TextField>
                  ) : (
                    <TextField label="State / region" value={form.region} onChange={update("region")} required fullWidth disabled={!form.country} sx={{ ...fieldSx, width: "100%" }} />
                  )}
                </Box>
                <Box sx={{ minWidth: 0, width: "100%" }}><TextField label="ZIP / postal code" value={form.postalCode} onChange={update("postalCode")} required fullWidth autoComplete="shipping postal-code" sx={fieldSx} /></Box>
              </Box>

              <Box sx={{ pt: 1 }}>
                <FormControl fullWidth>
                  <FormLabel sx={{ color: "var(--color-text-primary)", mb: 1 }}>Shipping method</FormLabel>
                  <Button type="button" variant="outlined" onClick={handleLoadShippingOptions} disabled={shippingLoading} sx={{ alignSelf: "flex-start", mb: 1.5, borderRadius: 999 }} startIcon={shippingLoading ? <CircularProgress size={16} color="inherit" /> : undefined}>
                    {shippingLoading ? "Loading live rates..." : "Get live shipping options"}
                  </Button>
                  <RadioGroup value={form.logisticName || form.method || ""} onChange={selectShippingOption}>
                    {shippingOptions.map((option) => (
                      <FormControlLabel
                        key={option.logisticName || option.method}
                        value={option.logisticName || option.method}
                        control={<Radio />}
                        label={<Box><Typography>{option.label || option.logisticName}</Typography><Typography variant="body2" color="var(--color-text-secondary)">{option.window || "Delivery time shown by carrier"} · ${Number(option.cost || 0).toFixed(2)}</Typography></Box>}
                      />
                    ))}
                  </RadioGroup>
                  {!shippingOptions.length && <Typography variant="body2" color="var(--color-text-secondary)">Enter your destination, then load the available carrier services.</Typography>}
                </FormControl>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button type="submit" variant="contained" size="large" disabled={shippingLoading} sx={{ borderRadius: 999, py: 1.3, fontWeight: 800 }}>Continue to payment</Button>
                <Button component={Link} href="/checkout/information" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Back to information</Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </CheckoutLayout>
  );
}
