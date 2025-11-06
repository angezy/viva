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

export default function ProductCarousel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data.slice(0, 8)))
      .catch((err) => console.error("Error fetching products:", err))
      .finally(() => setLoading(false));
  }, []);

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
      <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", textAlign: "center" }}>
        Featured Products
      </Typography>
      <Slider
        {...settings}
        style={{ marginLeft: "-12px", marginRight: "-12px" }} // compensate padding
      >
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
                      borderRadius: 3,
                      boxShadow: 3,
                      overflow: 'hidden',
                      height: '100%',
                    }}
                  >
                    {image ? (
                      <CardMedia component="img" height="180" image={image} alt={title} />
                    ) : (
                      <Skeleton variant="rectangular" height={180} />
                    )}

                    <CardContent>
                      <Typography variant="h6" noWrap sx={{ fontWeight: 'bold', mb: 1 }}>
                        {title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {desc || 'No description available.'}
                      </Typography>
                      <Typography variant="subtitle1" color="primary" sx={{ mt: 1, fontWeight: 'bold' }}>
                        ${price}
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
