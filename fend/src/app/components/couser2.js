"use client";
import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Skeleton,
} from "@mui/material";

export default function MostChosenScroll() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/mostchosen")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.slice(0, 8));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  
  const renderSkeletons = () =>
    Array.from(new Array(8)).map((_, i) => (
      <Card
        key={i}
        sx={{
          display: "inline-block",
          width: 250,
          mx: 1,
          borderRadius: 3,
          boxShadow: 1,
        }}
      >
        <Skeleton variant="rectangular" height={140} />
        <CardContent>
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
        </CardContent>
      </Card>
    ));

  return (
    <Box sx={{ overflowX: "auto", whiteSpace: "nowrap", p: 2 }}>
      {loading
        ? renderSkeletons()
        : items.map((item, index) => (
            <Card
              key={index}
              sx={{
                display: "inline-block",
                width: 250,
                mx: 1,
                borderRadius: 3,
                boxShadow: 3,
              }}
            >
              {item.image ? (
                <CardMedia
                  component="img"
                  height="140"
                  image={item.image}
                  alt={item.title || "Most chosen"}
                />
              ) : (
                <Skeleton variant="rectangular" height={140} />
              )}
              <CardContent>
                <Typography variant="h6" noWrap>
                  {item.title || "Untitled"}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.description || "No description"}
                </Typography>
              </CardContent>
            </Card>
          ))}
    </Box>
  );
}
