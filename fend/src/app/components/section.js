"use client";
import { useEffect, useState } from "react";
import { Box, Grid, Typography, Button, Skeleton } from "@mui/material";

export default function HeroSection() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box
      sx={{
        backgroundColor: "#f8c7d6",
        py: 6,
        px: { xs: 2, md: 6 },
      }}
    >
      <Grid container spacing={4} alignItems="center" justifyContent="center">
        {/* Left Image */}
        <Grid item xs={12} md={6}>
          {loading ? (
            <Skeleton
              variant="rectangular"
              width="100%"
              height={300}
              sx={{ borderRadius: 2 }}
            />
          ) : (
            <Box
              component="img"
              src="/images/hero-image.jpg" // replace with your image path
              alt="Wellness Hero"
              sx={{
                width: "100%",
                borderRadius: 2,
                boxShadow: 3,
                objectFit: "cover",
              }}
            />
          )}
        </Grid>

        {/* Right Text */}
        <Grid item xs={12} md={6}>
          {loading ? (
            <>
              <Skeleton variant="text" width="80%" height={40} />
              <Skeleton variant="text" width="100%" height={30} />
              <Skeleton variant="text" width="90%" height={30} />
              <Skeleton variant="rectangular" width={120} height={40} />
            </>
          ) : (
            <>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Welcome to Your Partner in Wellness.
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                We believe that beauty starts from within. Our team is dedicated
                to bringing you the best in skincare and wellness products that
                help you feel confident, radiant, and empowered every day.
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                From facial rollers to modern beauty tools, we ensure everything
                is safe, effective, and easy to use.
              </Typography>
              <Button
                variant="contained"
                sx={{
                  mt: 2,
                  backgroundColor: "black",
                  "&:hover": { backgroundColor: "#333" },
                }}
              >
                Shop Now
              </Button>
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
