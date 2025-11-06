"use client";
import React, { useEffect, useState } from "react";
import { Box, Button, Typography, Grid, Skeleton, Fade } from "@mui/material";

export default function ShopHeroBox() {
  const [head, setHead] = useState(null);
  const [loading, setLoading] = useState(true); // skeleton state
  const [fadeIn, setFadeIn] = useState(false);  // controls fade animation

  useEffect(() => {
    fetch("http://localhost:5000/api/head")
      .then((res) => res.json())
      .then((data) => {
        setHead(data[0]);
        setLoading(false);
        // Small delay to start fade for smoother UX
        setTimeout(() => setFadeIn(true), 100);
      })
      .catch((err) => {
        console.error("Error fetching head:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: 4,
          minHeight: 320,
          p: { xs: 4, md: 6 },
          background: "linear-gradient(to right, #e0e0e0, #f5f5f5)",
        }}
      >
        <Skeleton variant="text" width="60%" height={50} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="40%" height={30} sx={{ mb: 4 }} />
        <Skeleton variant="rectangular" width={160} height={48} />
      </Box>
    );
  }

  if (!head) return null;

  return (
    <Fade in={fadeIn} timeout={700}>
      <Box
        sx={{
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: 4,
          position: "relative",
          minHeight: 320,
          background: head?.ImgUrl
            ? `url('${head.ImgUrl}') center/cover no-repeat`
            : "linear-gradient(to right, #4f46e5, #9333ea, #ec4899)",
          "&::before": head?.ImgUrl
            ? {
                content: '""',
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, rgba(79,70,229,0.85) 60%, rgba(147,51,234,0.7) 80%, rgba(236,72,153,0.5))",
              }
            : {},
        }}
      >
        <Grid container sx={{ position: "relative", zIndex: 1 }}>
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              p: { xs: 4, md: 6 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: "bold", color: "white", mb: 3 }}
            >
              {head.Title}
            </Typography>
            <Typography
              variant="overline"
              sx={{ color: "rgba(255,255,255,0.85)", mb: 2 }}
            >
              {head.text}
            </Typography>
            <Button
              variant="contained"
              href={head.ButtonUrl}
              sx={{
                backgroundColor: "white",
                color: "#4f46e5",
                fontWeight: "600",
                textTransform: "none",
                px: 3,
                ":hover": { backgroundColor: "#f0f0f0" },
              }}
            >
              {head.Button}
            </Button>
          </Grid>
          <Grid item xs={false} md={6} />
        </Grid>
      </Box>
    </Fade>
  );
}
