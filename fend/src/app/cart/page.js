"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  fetchSession,
  fetchCart,
  updateCartItem,
  removeCartItem,
  checkoutCart,
} from "../lib/apiClient";

export default function CartPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const session = await fetchSession();
        if (!session) {
          setUser(null);
          setLoading(false);
          return;
        }
        setUser(session.user);
        const cart = await fetchCart();
        setItems(cart.items || []);
        setSubtotal(cart.subtotal || 0);
      } catch (err) {
        if (err.message === "unauthorized") {
          setUser(null);
        } else {
          setError(err.message || "Unable to load cart");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleQuantity = async (productId, delta) => {
    const current = items.find((i) => String(i.productId) === String(productId));
    if (!current) return;
    const next = Math.max(0, current.quantity + delta);
    try {
      const res = await updateCartItem(productId, next);
      setItems(res.items || []);
      setSubtotal(res.subtotal || 0);
    } catch (err) {
      if (err.message === "unauthorized") {
        setUser(null);
      } else {
        setError(err.message || "Unable to update quantity");
      }
    }
  };

  const handleRemove = async (productId) => {
    try {
      const res = await removeCartItem(productId);
      setItems(res.items || []);
      setSubtotal(res.subtotal || 0);
    } catch (err) {
      if (err.message === "unauthorized") {
        setUser(null);
      } else {
        setError(err.message || "Unable to remove item");
      }
    }
  };

  const handleCheckout = async () => {
    setMessage("");
    setError("");
    try {
      const res = await checkoutCart();
      setItems([]);
      setSubtotal(0);
      setMessage(`Order ${res.order?.id || ""} placed!`);
    } catch (err) {
      if (err.message === "unauthorized") {
        setUser(null);
      } else {
        setError(err.message || "Checkout failed");
      }
    }
  };

  const summary = (
    <Card sx={{ bgcolor: "#0f172a", color: "white", border: "1px solid rgba(255,255,255,0.08)" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Order Summary
        </Typography>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography color="rgba(255,255,255,0.7)">Subtotal</Typography>
          <Typography>${subtotal.toFixed(2)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography color="rgba(255,255,255,0.7)">Shipping</Typography>
          <Typography color="success.main">Free</Typography>
        </Stack>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", my: 1 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700 }}>Total</Typography>
          <Typography sx={{ fontWeight: 800 }}>${subtotal.toFixed(2)}</Typography>
        </Stack>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          disabled={!items.length || loading || !user}
          onClick={handleCheckout}
          sx={{ borderRadius: 2, textTransform: "none" }}
        >
          {loading ? "Loading..." : "Checkout"}
        </Button>
        {!user && (
          <Typography variant="body2" sx={{ mt: 1, color: "rgba(255,255,255,0.7)" }}>
            Sign in to place your order.
          </Typography>
        )}
        {message && (
          <Typography sx={{ mt: 1, color: "#34d399" }}>
            {message}
          </Typography>
        )}
        {error && (
          <Typography sx={{ mt: 1, color: "#fca5a5" }}>
            {error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container sx={{ py: 6 }}>
        <Typography>Loading cart...</Typography>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container sx={{ py: 6 }}>
        <Card sx={{ p: 3, borderRadius: 3, bgcolor: "#0f172a", color: "white" }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Sign in to view your cart
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.75)", mb: 2 }}>
            Items are saved to your session so you can check out securely.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" href="/signin" sx={{ borderRadius: 2 }}>
              Go to Sign in
            </Button>
            <Button variant="outlined" href="/shop" sx={{ borderRadius: 2, color: "white", borderColor: "rgba(255,255,255,0.2)" }}>
              Continue Shopping
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Box sx={{ backgroundColor: "#050714", minHeight: "100vh", color: "white", py: 6 }}>
      <Container>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 3 }}>
          Your Cart
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {items.length === 0 ? (
              <Card sx={{ p: 3, borderRadius: 3, bgcolor: "#0f172a", color: "rgba(255,255,255,0.8)" }}>
                <Typography>No items yet. Continue shopping to add products.</Typography>
                <Button href="/shop" sx={{ mt: 2 }} variant="outlined" color="primary">
                  Browse products
                </Button>
              </Card>
            ) : (
              <Stack spacing={2}>
                {items.map((item) => (
                  <Card
                    key={item.productId}
                    sx={{ display: "flex", alignItems: "center", borderRadius: 2, bgcolor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <CardMedia
                      component="img"
                      image={item.image || "https://placehold.co/120x120?text=Item"}
                      alt={item.title}
                      sx={{ width: 120, height: 120, objectFit: "cover" }}
                    />
                    <CardContent sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      <Typography color="primary.light" sx={{ mb: 1 }}>
                        ${item.price?.toFixed ? item.price.toFixed(2) : item.price}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button size="small" variant="outlined" onClick={() => handleQuantity(item.productId, -1)}>
                          -
                        </Button>
                        <Typography>{item.quantity}</Typography>
                        <Button size="small" variant="outlined" onClick={() => handleQuantity(item.productId, 1)}>
                          +
                        </Button>
                      </Stack>
                    </CardContent>
                    <IconButton color="error" onClick={() => handleRemove(item.productId)} sx={{ mr: 2 }}>
                      <DeleteIcon />
                    </IconButton>
                  </Card>
                ))}
              </Stack>
            )}
          </Grid>
          <Grid item xs={12} md={4}>
            {summary}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
