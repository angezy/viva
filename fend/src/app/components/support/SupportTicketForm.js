"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Container, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Link from "next/link";
import RichTextEditor from "./RichTextEditor";

const categories = ["Order", "Shipping", "Payment", "Refund", "Return", "Product Question", "Warranty", "Technical Issue", "Account", "Partnership"];
const priorities = ["Low", "Normal", "High", "Urgent"];

function textFromHtml(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").trim();
}

export default function SupportTicketForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerName: "", email: "", orderNumber: "", category: "Order", priority: "Normal", subject: "", contentHtml: "" });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/session", { credentials: "include" }).then((response) => (response.ok ? response.json() : null)).then((data) => {
      if (data?.user) setForm((prev) => ({ ...prev, email: data.user.email || prev.email, customerName: data.user.username || prev.customerName }));
    }).catch(() => {});
  }, []);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!textFromHtml(form.contentHtml)) return setError("Please add a message before submitting.");
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append("contentText", textFromHtml(form.contentHtml));
      files.forEach((file) => body.append("attachments", file));
      const response = await fetch("/api/support/tickets", { method: "POST", body, credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create ticket");
      if (data.ticket?.userId) router.push(`/support/tickets/${data.ticket.id}`);
      else setSuccess(`Ticket ${data.ticket?.ticketNumber || "created"} was received. We will reply to ${form.email}.`);
    } catch (submitError) {
      setError(submitError.message || "Unable to create ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="main" sx={{ bgcolor: "var(--color-background)", minHeight: "100vh", py: { xs: 3, md: 6 }, color: "var(--color-text-primary)" }}>
      <Container maxWidth="md">
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 3 }}><Box><Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 800, letterSpacing: "0.14em" }}>SUPPORT REQUEST</Typography><Typography component="h1" sx={{ fontWeight: 850, letterSpacing: "-0.05em", fontSize: { xs: "2.5rem", md: "4rem" }, lineHeight: 1 }}>Create a support ticket</Typography><Typography sx={{ color: "var(--color-text-secondary)", mt: 2, lineHeight: 1.7 }}>Tell us what happened. Include your order number when your request is about a purchase.</Typography></Box><Button component={Link} href="/account/support" sx={{ color: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>Back to Support</Button></Stack>
        <Paper component="form" onSubmit={submit} elevation={0} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, border: "1px solid var(--color-border)", bgcolor: "var(--color-surface)" }}>
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}><TextField required fullWidth label="Customer name" value={form.customerName} onChange={(event) => update("customerName", event.target.value)} /></Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}><TextField required fullWidth type="email" label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} /></Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}><TextField fullWidth label="Order number" value={form.orderNumber} onChange={(event) => update("orderNumber", event.target.value)} /></Grid>
            <Grid
              size={{
                xs: 12,
                sm: 3
              }}><TextField select fullWidth label="Category" value={form.category} onChange={(event) => update("category", event.target.value)}>{categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField></Grid>
            <Grid
              size={{
                xs: 12,
                sm: 3
              }}><TextField select fullWidth label="Priority" value={form.priority} onChange={(event) => update("priority", event.target.value)}>{priorities.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField></Grid>
            <Grid size={12}><TextField required fullWidth label="Subject" value={form.subject} onChange={(event) => update("subject", event.target.value)} /></Grid>
            <Grid size={12}><RichTextEditor label="Message" value={form.contentHtml} onChange={(value) => update("contentHtml", value)} minHeight={280} /></Grid>
            <Grid size={12}><Button component="label" variant="outlined" sx={{ borderRadius: 999, textTransform: "none", color: "var(--color-primary)", borderColor: "var(--color-primary)" }}>Add attachments<input hidden multiple type="file" accept="image/*,.pdf,.txt,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></Button>{files.length > 0 && <Typography component="span" sx={{ ml: 2, color: "var(--color-text-secondary)", fontSize: 13 }}>{files.map((file) => file.name).join(", ")}</Typography>}</Grid>
          </Grid>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
          <Button type="submit" disabled={saving} variant="contained" endIcon={<ArrowForwardIcon />} sx={{ mt: 3, borderRadius: 999, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>{saving ? "Sending..." : "Submit ticket"}</Button>
        </Paper>
      </Container>
    </Box>
  );
}
