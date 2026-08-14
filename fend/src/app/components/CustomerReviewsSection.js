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
        background: "linear-gradient(135deg, #0b1220 0%, #111c35 100%)",
        border: "1px solid rgba(148,163,184,0.2)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.2)",
      }}
    >
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Typography id="customer-review-form-title" variant="h4" sx={{ fontWeight: 800, color: "#fff", mb: 1 }}>
          Share your experience
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3 }}>
          Tell us about your Weluxo experience. Reviews are moderated before they are published.
        </Typography>

        {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

        <Box component="form" onSubmit={submitReview}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Your name" value={form.name} onChange={updateField("name")} required fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Email (optional)" type="email" value={form.email} onChange={updateField("email")} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Review title" value={form.title} onChange={updateField("title")} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%", minHeight: 56 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.78)", whiteSpace: "nowrap" }}>Your rating</Typography>
                <Rating value={Number(form.rating)} onChange={(_, value) => setForm((current) => ({ ...current, rating: value || 5 }))} />
              </Stack>
            </Grid>
            <Grid item xs={12}>
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
            <Grid item xs={12}>
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
