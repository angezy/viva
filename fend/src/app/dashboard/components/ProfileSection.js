"use client";
import React, { useEffect, useState } from "react";
import { Box, Grid, Card, CardContent, Avatar, Typography, Skeleton, Button } from "@mui/material";

export default function ProfileSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('http://localhost:5000/api/dashboard/profile')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || 'Failed to load');
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ mb: 4 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              {loading ? (
                <Skeleton variant="circular" width={64} height={64} />
              ) : (
                <Avatar src={profile?.avatar} sx={{ width: 64, height: 64 }}>{profile?.name?.[0]}</Avatar>
              )}
              <Box>
                <Typography variant="h6">
                  {loading ? <Skeleton width={120} /> : profile?.name}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {loading ? <Skeleton width={180} /> : profile?.email}
                </Typography>
              </Box>
            </CardContent>
            <CardContent>
              {loading ? (
                <>
                  <Skeleton width="100%" height={18} />
                  <Skeleton width="90%" />
                </>
              ) : (
                <Typography variant="body2">{profile?.bio}</Typography>
              )}
              <Box mt={2}>
                <Button size="small" variant="contained" disabled={loading}>
                  View profile
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {loading ? <Skeleton width={200} /> : "Quick Stats"}
              </Typography>
              {loading ? (
                <Grid container spacing={2}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Grid item xs={12} sm={4} key={i}>
                      <Skeleton variant="rounded" height={48} />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="subtitle2" color="text.secondary">Orders</Typography>
                    <Typography variant="h6">128</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="subtitle2" color="text.secondary">Revenue</Typography>
                    <Typography variant="h6">$23,450</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="subtitle2" color="text.secondary">Products</Typography>
                    <Typography variant="h6">320</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
