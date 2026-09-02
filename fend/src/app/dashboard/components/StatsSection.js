"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Grid, LinearProgress, Skeleton } from "@mui/material";

export default function StatsSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading ?? true);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => setLoading(true));
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setMetrics(Array.isArray(data?.metrics) ? data.metrics : [
          { name: "Conversion", value: 72 },
          { name: "Return Rate", value: 6 },
          { name: "Customer Satisfaction", value: 88 },
          { name: "Fulfillment", value: 93 },
        ]);
      })
      .catch((err) => console.error("Stats fetch error:", err))
      .finally(() => mounted && setLoading(false));

    return () => (mounted = false);
  }, []);

  const isLoading = parentLoading ?? loading;

  return (
    <Box sx={{ mb: 6 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Performance Metrics
          </Typography>
          {isLoading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Grid
                  key={i}
                  size={{
                    xs: 12,
                    sm: 6,
                    md: 3
                  }}>
                  <Box sx={{ p: 1.5, border: "1px solid #e2e8f0", borderRadius: 2 }}>
                    <Skeleton variant="text" width="58%" height={18} />
                    <Skeleton variant="text" width="42%" height={30} />
                    <Skeleton variant="rounded" width="100%" height={8} sx={{ mt: 1, borderRadius: 99 }} />
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {metrics.map((m) => (
                <Grid
                  key={m.name}
                  size={{
                    xs: 12,
                    sm: 6,
                    md: 3
                  }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {m.name}
                  </Typography>
                  <Typography variant="h6">{`${m.value}%`}</Typography>
                  <LinearProgress variant="determinate" value={m.value} sx={{ mt: 1, height: 8, borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
