"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Grid, Skeleton, List, ListItem, ListItemText, Chip } from "@mui/material";

export default function OrdersSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading ?? true);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetch("http://localhost:5000/api/dashboard/orders")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data)) {
          setOrders(data.map((o) => ({ id: o.id ?? o.orderId ?? o.OrderId, customer: o.customer ?? o.name, total: o.total ?? o.amount, status: o.status ?? "Pending", date: o.date ?? o.createdAt })));
        } else {
          setOrders([]);
        }
      })
      .catch((err) => console.error("Orders fetch error:", err))
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  const isLoading = parentLoading ?? loading;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Orders
          </Typography>
          {isLoading ? (
            <Grid container spacing={2}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Skeleton variant="rounded" height={72} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <List>
              {orders.map((o) => (
                <ListItem key={o.id} divider>
                  <ListItemText primary={`${o.id} — ${o.customer}`} secondary={o.total} />
                  <Chip label={o.status} color={o.status === "Processing" ? "warning" : o.status === "Delivered" ? "success" : "info"} size="small" />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

