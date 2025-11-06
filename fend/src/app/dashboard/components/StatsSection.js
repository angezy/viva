"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Grid, LinearProgress, Skeleton } from "@mui/material";

export default function StatsSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading ?? true);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("http://localhost:5000/api/dashboard/stats")
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
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Skeleton height={64} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {metrics.map((m) => (
                <Grid item xs={12} sm={6} md={3} key={m.name}>
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
