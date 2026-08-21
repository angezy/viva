"use client";
import React, { useEffect, useState } from "react";
import Slider from "react-slick";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function ProductCarousel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiBase = "";

  useEffect(() => {
    fetch(`${apiBase}/api/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data.slice(0, 8)))
      .catch((err) => console.error("Error fetching products:", err))
      .finally(() => setLoading(false));
  }, [apiBase]);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2500,
      responsive: [
      { breakpoint: 1200, settings: { slidesToShow: 3 } },
      { breakpoint: 900, settings: { slidesToShow: 2 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } },
    ],
  };

  // Render skeletons for loading state (professional card look)
  const renderSkeletons = () =>
    Array.from(new Array(4)).map((_, i) => (
      <Box key={i} px={1.5}>
        <Card
          sx={{
            borderRadius: 4,
            background: "#ffffff",
            border: "1px solid var(--color-border)",
            backdropFilter: "blur(16px)",
          }}
        >
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: "12px 12px 0 0" }} />
          <CardContent>
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="50%" />
          </CardContent>
        </Card>
      </Box>
    ));

  return (
    <Box
      sx={{
        maxWidth: 1300,
        mx: "auto",
        py: 8,
        px: 2,
        background: "linear-gradient(135deg, var(--color-primary-soft), var(--color-accent-soft))",
        borderRadius: 6,
      }}
    >
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="overline" sx={{ letterSpacing: 3, color: "primary.light" }}>
          Spotlight
        </Typography>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          Featured Drops
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Curated picks refreshed every day, tailored to your vibe.
        </Typography>
      </Box>
      <Slider {...settings} style={{ marginLeft: "-12px", marginRight: "-12px" }}>
        {loading
          ? renderSkeletons()
          : products.map((product) => {
              // normalize product fields to match consistent UI
              const image = product.img || product.imageUrl || product.image || '';
              const title = product.name || product.title || 'Untitled';
              const desc = product.description || product.desc || '';
              const price = typeof product.price === 'number' ? product.price : (product.Price ?? 0);

              return (
                <Box key={product.id ?? product.PID ?? title} px={1.5}>
                  <Card
                    sx={{
                      borderRadius: 4,
                      background: "#ffffff",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-primary)",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      boxShadow: "0 20px 40px rgba(43,43,43,0.08)",
                      transition: "transform 0.35s ease, box-shadow 0.35s ease",
                      "&:hover": { transform: "translateY(-6px)", boxShadow: "0 30px 60px rgba(43,43,43,0.12)" },
                    }}
                  >
                    {image ? (
                      <CardMedia
                        component="img"
                        height="220"
                        image={image}
                        alt={title}
                        sx={{ objectFit: "cover", filter: "saturate(1.1)", borderBottom: "1px solid var(--color-border)" }}
                      />
                    ) : (
                      <Skeleton variant="rectangular" height={220} />
                    )}

                    <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                          {title}
                        </Typography>
                        <Chip label={`$${price}`} color="primary" size="small" sx={{ fontWeight: 600 }} />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "var(--color-text-secondary)",
                          mb: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {desc || "No description available."}
                      </Typography>
                      <Box sx={{ mt: "auto" }}>
                        <Button variant="contained" color="primary" fullWidth sx={{ borderRadius: 999 }}>
                          View Product
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
      </Slider>
    </Box>
  );
}
