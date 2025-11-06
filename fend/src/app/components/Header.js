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
} from "@mui/material";
import Link from "next/link";

export default function Header() {
  const [header, setHeader] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fadeIn, setFadeIn] = useState(false); // controls fade

  useEffect(() => {
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
  }, []);

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
                  <Button component={Link} href="/" color="inherit">{header.Home}</Button>
                  <Button component={Link} href="/blog" color="inherit">{header.Blog}</Button>
                  <Button component={Link} href="/shop" color="inherit">{header.Shop}</Button>
                  <Button component={Link} href="/aboutus" color="inherit">{header.AboutUs}</Button>
                </>
              )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
