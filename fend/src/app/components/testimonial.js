"use client";
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Grid,
  Rating,
  Skeleton,
  TextField,
  Button,
} from "@mui/material";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Clinic Owner",
    text: "This platform completely changed the way I connect with clients. The process was seamless and professional.",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 5,
  },
  {
    name: "Michael Lee",
    role: "Therapist",
    text: "I love how intuitive the system is. It saves me hours of admin work every week!",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 4,
  },
  {
    name: "Emily Davis",
    role: "Psychologist",
    text: "Great experience from start to finish. The support team is always there when you need them.",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
    rating: 5,
  },
];

export default function TestimonialSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");

  // simulate async fetch
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setItems(testimonials);
      setLoading(false);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const commentItem = {
      name: "You",
      role: "User",
      text: newComment.trim(),
      avatar: "https://ui-avatars.com/api/?name=You&background=0D8ABC&color=fff",
      rating: 5,
    };
    setItems((s) => [commentItem, ...s]);
    setNewComment("");
  };

  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        background: "linear-gradient(135deg, #f5f7fa, #e4ebf5)",
      }}
    >
      <Typography variant="h4" align="center" fontWeight="bold" gutterBottom>
        What Our Clients Say
      </Typography>
      <Typography
        variant="subtitle1"
        align="center"
        color="text.secondary"
        mb={4}
      >
        Real feedback from professionals who trust us
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          justifyContent: "center",
          mb: 4,
          px: 2,
          flexWrap: "wrap",
        }}
      >
        <TextField
          placeholder="Comment here..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
        <Button variant="contained" onClick={handleAddComment} disabled={!newComment.trim()}>
          Submit
        </Button>
      </Box>

      <Grid container spacing={4} justifyContent="center">
        {loading
          ? // show 3 skeleton cards while loading
            [0, 1, 2].map((n) => (
              <Grid item xs={12} sm={6} md={4} key={n}>
                <Card elevation={0} sx={{ p: 3, borderRadius: "20px" }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="60%" height={20} />
                        <Skeleton width="40%" height={16} />
                      </Box>
                    </Box>
                    <Skeleton width="30%" height={24} />
                    <Skeleton variant="rectangular" height={60} sx={{ mt: 2, borderRadius: 1 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : items.map((t, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card
                  elevation={3}
                  sx={{
                    p: 3,
                    borderRadius: "20px",
                    transition: "0.3s",
                    "&:hover": { transform: "translateY(-6px)", boxShadow: 6 },
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar src={t.avatar} alt={t.name} sx={{ width: 56, height: 56, mr: 2 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {t.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.role}
                        </Typography>
                      </Box>
                    </Box>
                    <Rating value={t.rating} readOnly size="small" />
                    <Typography variant="body1" mt={2} color="text.primary" sx={{ fontStyle: "italic" }}>
                        {t.text}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
      </Grid>
    </Box>
  );
}
