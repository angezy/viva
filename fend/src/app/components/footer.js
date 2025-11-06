"use client";
import React, { useEffect, useState } from "react";
import { Box, Alert, Typography, Grid, Link as MuiLink, Skeleton, IconButton } from "@mui/material";
import { Facebook, Twitter, Instagram, LinkedIn } from "@mui/icons-material";

export default function Footer() {
  const [footer, setFooter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    fetch("http://localhost:5000/api/footer")
      .then((res) => res.json())
      .then((data) => {
        setFooter(data[0]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching footer:", err);
        setLoading(false);
        setError("Failed to load header.");

      });
  }, []);

  if (!footer && !loading) return null;

  // ❌ Error State
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      component="footer"
      sx={{
        width: "100%",
        backgroundColor: "#111827",
        color: "white",
        py: 6,
        px: { xs: 4, md: 8 },
      }}
    >
      <Grid container spacing={4} justifyContent="space-between">
        {/* Logo & Description */}
        <Grid item xs={12} md={4}>
          {loading ? (
            <>
              <Skeleton variant="rectangular" width={150} height={40} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="60%" height={20} />
            </>
          ) : (
            <>
              <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
                {footer.logoText}
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                {footer.description}
              </Typography>
            </>
          )}
        </Grid>

        {/* Quick Links */}
        <Grid item xs={12} md={4}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
            Quick Links
          </Typography>
          {loading ? (
            <>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="50%" height={20} />
              <Skeleton variant="text" width="70%" height={20} />
            </>
          ) : (
            <>
              <MuiLink href={footer.homeHref} underline="hover" sx={{ display: "block", mb: 1, color: "rgba(255,255,255,0.8)" }}>{footer.homeLabel}</MuiLink>
              <MuiLink href={footer.shopHref} underline="hover" sx={{ display: "block", mb: 1, color: "rgba(255,255,255,0.8)" }}>{footer.shopLabel}</MuiLink>
              <MuiLink href={footer.blogHref} underline="hover" sx={{ display: "block", mb: 1, color: "rgba(255,255,255,0.8)" }}>{footer.blogLabel}</MuiLink>
              <MuiLink href={footer.aboutusHref} underline="hover" sx={{ display: "block", mb: 1, color: "rgba(255,255,255,0.8)" }}>{footer.aboutusLabel}</MuiLink>
            </>
          )}
        </Grid>

        {/* Social Icons */}
        <Grid item xs={12} md={4}>
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
            Follow Us
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="circular" width={40} height={40} />
            </Box>
          ) : (
            <Box sx={{ display: "flex", gap: 1 }}>
              {footer.facebook && (
                <IconButton href={footer.facebook} sx={{ color: "white" }}>
                  <Facebook />
                </IconButton>
              )}
              {footer.twitter && (
                <IconButton href={footer.twitter} sx={{ color: "white" }}>
                  <Twitter />
                </IconButton>
              )}
              {footer.instagram && (
                <IconButton href={footer.instagram} sx={{ color: "white" }}>
                  <Instagram />
                </IconButton>
              )}
              {footer.linkedin && (
                <IconButton href={footer.linkedin} sx={{ color: "white" }}>
                  <LinkedIn />
                </IconButton>
              )}
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Bottom Copy */}
      <Box mt={6} textAlign="center" sx={{ color: "rgba(255,255,255,0.5)" }}>
        {loading ? <Skeleton variant="text" width="40%" sx={{ mx: "auto" }} /> : `© ${new Date().getFullYear()} ${footer.logoText}. All rights reserved.`}
      </Box>
    </Box>
  );
}
