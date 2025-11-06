"use client";
import React, { useEffect, useState } from "react";
import Slider from "react-slick";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
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
        <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
          <Skeleton variant="rectangular" height={180} />
          <CardContent>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </CardContent>
        </Card>
      </Box>
    ));

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", py: 6 }}>
      <Typography
        variant="h4"
        sx={{ mb: 3, fontWeight: "bold", textAlign: "center" }}
      >
        Most Chosen
      </Typography>

      <Slider
        {...settings}
        style={{ marginLeft: "-12px", marginRight: "-12px" }}
      >
        {loading
          ? renderSkeletons()
          : items.map((item) => {
              // normalize fields coming from different backends
              const image = item.img || item.imageUrl || item.image || item.Img || "";
              const title = item.title || item.Name || item.name || "Untitled";
              const desc = item.description || item.Description || item.desc || "";

              return (
                <Box key={item.id ?? item.PID ?? title} px={1.5}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      boxShadow: 3,
                      overflow: "hidden",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {image ? (
                      <CardMedia component="img" height="180" image={image} alt={title} />
                    ) : (
                      <Skeleton variant="rectangular" height={180} />
                    )}

                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" noWrap sx={{ fontWeight: "bold", mb: 1 }}>
                        {title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
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
                </Box>
              );
            })}
      </Slider>
    </Box>
  );
}
