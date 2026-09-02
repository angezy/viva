"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Skeleton, List, ListItem, ListItemText, Chip, Stack } from "@mui/material";

export default function OrdersSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading ?? true);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard/orders")
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
            <Stack spacing={0.5}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={56} sx={{ borderRadius: 1.5 }} />)}
            </Stack>
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

