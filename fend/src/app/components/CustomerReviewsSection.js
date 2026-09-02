"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function CustomerReviewsSection() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", title: "", text: "", rating: 5 });

  function updateField(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submitReview(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to submit review");

      setForm((current) => ({ ...current, title: "", text: "", rating: 5 }));
      setMessage(data.message || "Thank you. Your review is waiting for approval.");
    } catch (submitError) {
      setError(submitError.message || "Unable to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      component="section"
      aria-labelledby="customer-review-form-title"
      sx={{
        mt: 7,
        mb: 2,
        p: { xs: 2, md: 4 },
        borderRadius: 4,
        background: "linear-gradient(135deg, var(--color-primary-soft) 0%, #ffffff 100%)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 18px 50px rgba(43,43,43,0.08)",
      }}
    >
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Typography id="customer-review-form-title" variant="h4" sx={{ fontWeight: 800, color: "var(--color-text-primary)", mb: 1 }}>
          Share your experience
        </Typography>
        <Typography sx={{ color: "var(--color-text-secondary)", mb: 3 }}>
          Tell us about your Weluxo experience. Reviews are moderated before they are published.
        </Typography>

        {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

        <Box component="form" onSubmit={submitReview}>
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField label="Your name" value={form.name} onChange={updateField("name")} required fullWidth />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField label="Email (optional)" type="email" value={form.email} onChange={updateField("email")} fullWidth />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <TextField label="Review title" value={form.title} onChange={updateField("title")} fullWidth />
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 6
              }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%", minHeight: 56 }}>
                <Typography sx={{ color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>Your rating</Typography>
                <Rating value={Number(form.rating)} onChange={(_, value) => setForm((current) => ({ ...current, rating: value || 5 }))} />
              </Stack>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Tell us about your experience"
                value={form.text}
                onChange={updateField("text")}
                required
                fullWidth
                multiline
                minRows={4}
                inputProps={{ minLength: 10, maxLength: 2000 }}
              />
            </Grid>
            <Grid size={12}>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !form.name.trim() || form.text.trim().length < 10}
                sx={{ borderRadius: 2, px: 3, py: 1.25, fontWeight: 800, textTransform: "none" }}
              >
                {submitting ? "Submitting…" : "Submit review"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
