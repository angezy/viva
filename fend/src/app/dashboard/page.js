"use client";
import { Box, Typography, Grid, Card, CardContent, Skeleton } from "@mui/material";
import { useEffect, useState } from "react";
import ProfileSection from "./components/ProfileSection";
import OrdersSection from "./components/OrdersSection";
import NotificationsSection from "./components/NotificationsSection";
import SettingsSection from "./components/SettingsSection";
import StatsSection from "./components/StatsSection";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500); // simulate data fetch
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    { title: "Total Orders", value: 128 },
    { title: "Pending Orders", value: 12 },
    { title: "Total Revenue", value: "$23,450" },
    { title: "Products in Stock", value: 320 },
  ];

  return (
    <Box sx={{ p: 4, bgcolor: "#f9fafb", minHeight: "100vh" }}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Store Dashboard
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={4}>
        {loading
          ? [...Array(4)].map((_, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rounded" height={100} animation="wave" />
              </Grid>
            ))
          : stats.map((stat, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      {stat.title}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {stat.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
      </Grid>

      {/* Dashboard Sections */}
      <ProfileSection loading={loading} />
      <OrdersSection loading={loading} />
      <NotificationsSection loading={loading} />
      <SettingsSection loading={loading} />
      <StatsSection loading={loading} />
    </Box>
  );
}
