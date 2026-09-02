"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";

const emptyForm = { code: "", discountPercent: "10", expiresAt: "" };

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusColor(status) {
  if (status === "Active") return "success";
  if (status === "Expired") return "warning";
  return "default";
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeCount = useMemo(() => coupons.filter((coupon) => coupon.status === "Active").length, [coupons]);

  async function loadCoupons() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/coupons", { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body.error || "Unable to load coupons");
      setCoupons(Array.isArray(body) ? body : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load coupons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(loadCoupons);
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: field === "code" ? value.toUpperCase() : value }));
    setMessage("");
    setError("");
  }

  async function createCoupon(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!form.code.trim() || !form.expiresAt) {
      setError("Enter a coupon code and an expiration date.");
      return;
    }
    const expiresAt = new Date(form.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      setError("Expiration must be in the future.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/coupons", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountPercent: Number(form.discountPercent),
          expiresAt: expiresAt.toISOString(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to create coupon");
      setCoupons((current) => [body, ...current]);
      setForm(emptyForm);
      setMessage(`${body.code} is ready to use at checkout.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to create coupon");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCoupon(coupon) {
    if (coupon.status === "Expired") return;
    setUpdatingId(coupon.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/dashboard/coupons/${encodeURIComponent(coupon.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to update coupon");
      setCoupons((current) => current.map((entry) => entry.id === body.id ? body : entry));
      setMessage(`${body.code} is now ${body.status.toLowerCase()}.`);
    } catch (updateError) {
      setError(updateError.message || "Unable to update coupon");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 850, letterSpacing: "0.14em" }}>Marketing tools</Typography>
          <Typography component="h1" sx={{ mt: 0.5, color: "#0f172a", fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: "-0.04em" }}>Coupons</Typography>
          <Typography sx={{ mt: 0.75, color: "#64748b", maxWidth: 720 }}>Create percentage discounts that customers can apply in the cart before secure checkout. Expired codes stop working automatically.</Typography>
        </Box>
        <Chip icon={<LocalOfferOutlinedIcon />} label={`${activeCount} active`} color="primary" variant="outlined" />
      </Stack>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3, borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 8px 25px rgba(15,23,42,0.05)" }}>
        <CardContent component="form" onSubmit={createCoupon} sx={{ p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <AddOutlinedIcon sx={{ color: "var(--color-primary)" }} />
            <Typography sx={{ color: "#0f172a", fontSize: 19, fontWeight: 850 }}>Create a coupon</Typography>
          </Stack>
          <Typography sx={{ color: "#64748b", fontSize: 13, mb: 2.5 }}>Codes are case-insensitive and become active as soon as they are saved.</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-start" }}>
            <TextField fullWidth label="Coupon code" value={form.code} onChange={(event) => updateForm("code", event.target.value)} placeholder="SUMMER20" inputProps={{ maxLength: 64, spellCheck: false }} helperText="3-64 letters, numbers, hyphens, or underscores" />
            <TextField fullWidth label="Discount percentage" type="number" value={form.discountPercent} onChange={(event) => updateForm("discountPercent", event.target.value)} inputProps={{ min: 0.01, max: 100, step: 0.01 }} InputProps={{ endAdornment: <Typography sx={{ color: "#64748b" }}>%</Typography> }} />
            <TextField fullWidth label="Expires" type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm("expiresAt", event.target.value)} InputLabelProps={{ shrink: true }} helperText="Customers cannot use the code after this time" />
            <Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <AddOutlinedIcon />} sx={{ minWidth: 150, minHeight: 56, borderRadius: 2, fontWeight: 800 }}>{saving ? "Saving..." : "Create coupon"}</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 8px 25px rgba(15,23,42,0.05)" }}>
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          <Box sx={{ p: { xs: 2, md: 3 }, pb: 2 }}>
            <Typography sx={{ color: "#0f172a", fontSize: 19, fontWeight: 850 }}>All coupons</Typography>
            <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.5 }}>Inactive and expired coupons remain visible for reference.</Typography>
          </Box>
          <Divider />
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={28} /></Stack>
          ) : !coupons.length ? (
            <Typography sx={{ p: 3, color: "#64748b" }}>No coupons have been created yet.</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead><TableRow><TableCell sx={{ fontWeight: 800 }}>Code</TableCell><TableCell sx={{ fontWeight: 800 }}>Discount</TableCell><TableCell sx={{ fontWeight: 800 }}>Expires</TableCell><TableCell sx={{ fontWeight: 800 }}>Status</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell></TableRow></TableHead>
                <TableBody>
                  {coupons.map((coupon, index) => (
                    <TableRow key={coupon.id ?? coupon.code ?? `coupon-${index}`} hover>
                      <TableCell><Typography sx={{ fontWeight: 850, letterSpacing: "0.04em" }}>{coupon.code}</Typography></TableCell>
                      <TableCell>{Number(coupon.discountPercent).toFixed(2).replace(/\.00$/, "")} %</TableCell>
                      <TableCell>{formatDate(coupon.expiresAt)}</TableCell>
                      <TableCell><Chip size="small" label={coupon.status} color={statusColor(coupon.status)} /></TableCell>
                      <TableCell align="right"><Button size="small" onClick={() => toggleCoupon(coupon)} disabled={coupon.status === "Expired" || updatingId === coupon.id} sx={{ textTransform: "none" }}>{updatingId === coupon.id ? "Saving..." : coupon.isActive ? "Deactivate" : "Reactivate"}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
