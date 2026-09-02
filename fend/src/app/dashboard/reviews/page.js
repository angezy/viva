"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";

function initials(name) {
  return String(name || "Customer")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function ReviewsAdminPage() {
  const [status, setStatus] = useState("all");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reviews?status=${encodeURIComponent(status)}`, { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load reviews");
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load reviews");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    queueMicrotask(loadReviews);
  }, [loadReviews]);

  async function moderate(reviewId, action) {
    setBusyId(`${reviewId}:${action}`);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update review");
      setMessage(action === "publish" ? "Review published on the home page." : action === "reject" ? "Review rejected." : "Review feature status updated.");
      if (status === "all") {
        setReviews((current) => current.map((review) => review.id === reviewId ? data.review : review));
      } else {
        setReviews((current) => current.filter((review) => review.id !== reviewId));
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to update review");
    } finally {
      setBusyId("");
    }
  }

  const counts = useMemo(() => reviews.reduce((result, review) => {
    result[review.status] = (result[review.status] || 0) + 1;
    return result;
  }, {}), [reviews]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: "100vh", background: "#f8fafc" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} sx={{ mb: 1 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "primary.main", letterSpacing: 2, fontWeight: 800 }}>CUSTOMER EXPERIENCE</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Reviews</Typography>
          <Typography color="text.secondary">Review customer feedback before it appears publicly on the home page.</Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="review-status-label">Status</InputLabel>
          <Select labelId="review-status-label" value={status} label="Status" onChange={(event) => setStatus(event.target.value)}>
            <MenuItem value="all">All reviews</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Approved">Published</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap" }}>
        <Chip label={`${counts.Pending || 0} pending`} color="warning" variant="outlined" />
        <Chip label={`${counts.Approved || 0} published`} color="success" variant="outlined" />
        <Chip label={`${counts.Rejected || 0} rejected`} color="error" variant="outlined" />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      ) : reviews.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary">No reviews found for this filter.</Typography></CardContent></Card>
      ) : (
        <Grid container spacing={2}>
          {reviews.map((review) => (
            <Grid
              key={review.id}
              size={{
                xs: 12,
                md: 6,
                xl: 4
              }}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: "primary.main" }}>{initials(review.name)}</Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>{review.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{review.email || "No email provided"}</Typography>
                      </Box>
                    </Stack>
                    <Chip size="small" label={review.status} color={review.status === "Approved" ? "success" : review.status === "Pending" ? "warning" : "error"} />
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                    {Array.from({ length: 5 }).map((_, index) => <StarIcon key={index} fontSize="small" sx={{ color: index < review.rating ? "#f59e0b" : "#cbd5e1" }} />)}
                    <Typography variant="caption" color="text.secondary">{review.rating}/5</Typography>
                  </Stack>
                  {review.title && <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.75 }}>{review.title}</Typography>}
                  <Typography sx={{ color: "text.secondary", lineHeight: 1.7 }}>“{review.text}”</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>{formatDate(review.createdAt)}</Typography>
                </CardContent>
                <Stack direction="row" spacing={1} sx={{ p: 2, pt: 0, flexWrap: "wrap" }}>
                  {review.status !== "Approved" && <Button size="small" variant="contained" color="success" disabled={!!busyId} onClick={() => moderate(review.id, "publish")}>{busyId === `${review.id}:publish` ? "Publishing…" : "Publish"}</Button>}
                  {review.status !== "Rejected" && <Button size="small" variant="outlined" color="error" disabled={!!busyId} onClick={() => moderate(review.id, "reject")}>{busyId === `${review.id}:reject` ? "Rejecting…" : "Reject"}</Button>}
                  {review.status === "Approved" && <Button size="small" variant="outlined" disabled={!!busyId} onClick={() => moderate(review.id, review.isFeatured ? "unfeature" : "feature")}>{review.isFeatured ? "Remove featured" : "Feature on home"}</Button>}
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
