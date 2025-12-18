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
import Stack from "@mui/material/Stack";
import Link from "next/link";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function MostChosenCarousel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/most-chosen")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((err) => console.error("Error fetching items:", err))
      .finally(() => setLoading(false));
  }, []);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2500,
    responsive: [
      { breakpoint: 900, settings: { slidesToShow: 2 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } },
    ],
  };

  const renderSkeletons = () =>
    Array.from(new Array(3)).map((_, i) => (
      <Box key={i} px={1.5}>
        <Card
          sx={{
            borderRadius: 4,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(18px)",
          }}
        >
          <Skeleton variant="rectangular" height={210} sx={{ borderRadius: "12px 12px 0 0" }} />
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
        py: 7,
        px: 2,
        background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(6,182,212,0.12))",
        borderRadius: 6,
      }}
    >
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="overline" sx={{ letterSpacing: 4, color: "secondary.light" }}>
          Community Picks
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Most Chosen Products
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Loved by thousands. Discover what the crowd can’t stop buying.
        </Typography>
      </Box>

      <Slider {...settings} style={{ marginLeft: "-12px", marginRight: "-12px" }}>
        {loading
          ? renderSkeletons()
          : items.map((item) => {
              // normalize fields coming from different backends
              const image = item.img || item.imageUrl || item.image || item.Img || "";
              const title = item.title || item.Name || item.name || "Untitled";
              const desc = item.description || item.Description || item.desc || "";

              return (
                <Box key={item.id ?? item.PID ?? title} px={1.5}>
                  <Link
                    href={item.slug ? `/product/${item.slug}` : "/shop"}
                    style={{ textDecoration: "none" }}
                    prefetch={false}
                  >
                    <Card
                      sx={{
                        borderRadius: 4,
                        boxShadow: "0 25px 45px rgba(10,10,30,0.28)",
                        overflow: "hidden",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(12,18,29,0.9)",
                        color: "white",
                        transition: "transform 0.35s ease, box-shadow 0.35s ease",
                        "&:hover": { transform: "translateY(-8px)", boxShadow: "0 30px 60px rgba(10,10,30,0.4)" },
                      }}
                    >
                      {image ? (
                        <CardMedia component="img" height="210" image={image} alt={title} sx={{ objectFit: "cover" }} />
                      ) : (
                        <Skeleton variant="rectangular" height={210} />
                      )}

                      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
                            {title}
                          </Typography>
                          <Chip size="small" label="Trending" color="secondary" />
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "rgba(255,255,255,0.7)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {desc || "No description available."}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Link>
                </Box>
              );
            })}
      </Slider>
    </Box>
  );
}
