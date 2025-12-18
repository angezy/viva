"use client";
import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Avatar,
  Skeleton,
  Alert,
  Fade,
  Popover,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Stack,
} from "@mui/material";
import Link from "next/link";
import { fetchCart, checkoutCart, fetchSession } from "../lib/apiClient";

export default function Header({ initialHeader = null, disableNav = false }) {
  const [header, setHeader] = useState(initialHeader);
  const [loading, setLoading] = useState(!initialHeader);
  const [error, setError] = useState(null);
  const [fadeIn, setFadeIn] = useState(false); // controls fade
  const [cartAnchor, setCartAnchor] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");

  useEffect(() => {
    if (initialHeader) {
      setFadeIn(true);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    fetch(`${apiUrl}/api/header`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHeader(data[0]);
        setTimeout(() => setFadeIn(true), 100); // slight delay for fade
      })
      .catch((err) => {
        console.error("Error fetching header:", err);
        setError("Failed to load header.");
      })
      .finally(() => setLoading(false));
  }, [initialHeader]);

  const handleNav = (href) => (e) => {
    if (disableNav) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const loadCart = async () => {
    setCartError("");
    setCartLoading(true);
    try {
      const session = await fetchSession();
      if (!session) throw new Error("Sign in to view cart");
      const cart = await fetchCart();
      setCartItems(cart.items || []);
      setCartSubtotal(cart.subtotal || 0);
    } catch (err) {
      setCartError(err.message || "Unable to load cart");
    } finally {
      setCartLoading(false);
    }
  };

  const handleCartClick = (event) => {
    if (disableNav) return;
    setCartAnchor(event.currentTarget);
    loadCart();
  };

  const handleCartClose = () => {
    setCartAnchor(null);
  };

  const cartOpen = Boolean(cartAnchor);

  const handleCheckout = async () => {
    try {
      await checkoutCart();
      window.location.href = "/cart";
    } catch (err) {
      setCartError(err.message || "Checkout failed");
    }
  };

  // ❌ Error State
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <AppBar position="static" color="default" sx={{ mb: 4, px: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {/* 🔹 Logo */}
          {loading ? (
            <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          ) : (
            <Fade in={fadeIn} timeout={600}>
              <Avatar src={header.LogoUrl} alt={header.Name} sx={{ mr: 2 }} />
            </Fade>
          )}

          {/* 🔹 Title */}
          {loading ? (
            <Skeleton variant="text" width={120} height={32} />
          ) : (
            <Fade in={fadeIn} timeout={600}>
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                {header.Name}
              </Typography>
            </Fade>
          )}
        </Box>

        {/* 🔹 Navigation Links */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  width={70}
                  height={36}
                  sx={{ ml: 1, borderRadius: 1 }}
                />
              ))
            : (
                <>
                  <Button component={Link} href="/" color="inherit" onClick={handleNav("/")}>
                    {header.Home}
                  </Button>
                  <Button component={Link} href="/blog" color="inherit" onClick={handleNav("/blog")}>
                    {header.Blog}
                  </Button>
                  <Button component={Link} href="/shop" color="inherit" onClick={handleNav("/shop")}>
                    {header.Shop}
                  </Button>
                  <Button component={Link} href="/aboutus" color="inherit" onClick={handleNav("/aboutus")}>
                    {header.AboutUs}
                  </Button>
                  <Button color="primary" variant="outlined" sx={{ ml: 1 }} onClick={handleCartClick}>
                    Cart
                  </Button>
                  <Button component={Link} href="/account" color="primary" variant="contained" sx={{ ml: 1, borderRadius: 2 }} onClick={handleNav("/account")}>
                    Account
                  </Button>
                </>
              )}
        </Box>
      </Toolbar>
      <Popover
        open={cartOpen}
        anchorEl={cartAnchor}
        onClose={handleCartClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: { width: 360, p: 1.5, borderRadius: 2, boxShadow: 3 },
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Cart</Typography>
        {cartLoading ? (
          <Typography sx={{ color: "text.secondary", fontSize: 14 }}>Loading...</Typography>
        ) : cartError ? (
          <Typography sx={{ color: "error.main", fontSize: 14 }}>{cartError}</Typography>
        ) : cartItems.length === 0 ? (
          <Typography sx={{ color: "text.secondary", fontSize: 14 }}>Cart is empty</Typography>
        ) : (
          <>
            <List dense disablePadding>
              {cartItems.map((item) => (
                <ListItem key={item.productId} disableGutters>
                  <ListItemAvatar>
                    <Avatar
                      src={item.image || undefined}
                      alt={item.title || "item"}
                      variant="rounded"
                      sx={{ width: 40, height: 40, mr: 1 }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={item.title || "Item"}
                    secondary={`Qty ${item.quantity} · $${(item.price || 0).toFixed ? item.price.toFixed(2) : item.price}`}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
                    secondaryTypographyProps={{ fontSize: 12 }}
                  />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontWeight: 700 }}>Subtotal</Typography>
              <Typography sx={{ fontWeight: 700 }}>${(cartSubtotal || 0).toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                component={Link}
                href="/cart"
                onClick={handleNav("/cart")}
              >
                View cart
              </Button>
              <Button fullWidth variant="contained" onClick={handleCheckout}>
                Checkout
              </Button>
            </Stack>
          </>
        )}
      </Popover>
    </AppBar>
  );
}
