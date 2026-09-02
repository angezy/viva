"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Box, Button, Card, CardContent, Container, Divider, Stack, Typography } from "@mui/material";
import { fetchOrderById } from "../../lib/apiClient";
import { DetailPageSkeleton } from "../../components/LoadingSkeletons";

export default function InvoicePage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrderById(orderId).then((result) => setOrder(result.order || null)).catch((loadError) => setError(loadError.message || "Unable to load invoice."));
  }, [orderId]);

  if (error) return <Container sx={{ py: 8 }}><Typography color="error">{error}</Typography></Container>;
  if (!order) return <DetailPageSkeleton />;

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
            <Box><Typography variant="h4" sx={{ fontWeight: 900 }}>Weluxo invoice</Typography><Typography color="text.secondary">Order #{order.id}</Typography></Box>
            <Button variant="outlined" onClick={() => window.print()}>Print invoice</Button>
          </Stack>
          <Stack spacing={1}>{(order.items || []).map((item, index) => <Stack direction="row" justifyContent="space-between" key={`${item.title}-${index}`}><Typography>{item.quantity} × {item.title}</Typography><Typography>${Number(item.price || 0).toFixed(2)}</Typography></Stack>)}</Stack>
          <Divider sx={{ my: 3 }} />
          <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Total</Typography><Typography sx={{ fontWeight: 900 }}>${Number(order.total || 0).toFixed(2)}</Typography></Stack>
          <Typography sx={{ mt: 3 }} color="text.secondary">Payment: {order.paymentStatus || "Pending"} · Method: {order.paymentMethod || "—"}</Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
