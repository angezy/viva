"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

const FALLBACK = {
  hero: {
    title: "Smart Wellness Starts Here.",
    subtitle: "Stories, tips, and training insights from coaches and athletes.",
    ctaText: "Read the latest",
    ctaUrl: "/blog",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    alt: "Athlete with smart trainer",
  },
  posts: [
    {
      id: "post-1",
      title: "Ergonomic Design That Powers Every Move",
      excerpt: "We broke down the biomechanics behind our latest release—here’s how it keeps you stable and strong.",
      author: "Coach Alex",
      date: "2024-12-01",
      image: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80",
      alt: "Closeup of training gear",
      tags: ["Gear", "Design"],
      slug: "/blog/ergonomic-design",
    },
  ],
};

export default function BlogSection({ initialContent = null, onEdit = {} }) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (initialContent) {
      queueMicrotask(() => setContent(initialContent));
      return;
    }
    fetch("/api/dashboard/blog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setContent(data))
      .catch(() => setContent(FALLBACK));
  }, [initialContent]);

  const data = content || FALLBACK;
  const posts = Array.isArray(data.posts) && data.posts.length ? data.posts : FALLBACK.posts;
  const hero = data.hero || FALLBACK.hero;

  const renderEditButton = (key) =>
    onEdit[key] ? (
      <IconButton
        size="small"
        onClick={onEdit[key]}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "var(--color-accent-soft)",
          color: "var(--color-primary)",
          "&:hover": { bgcolor: "var(--color-primary-soft)" },
          zIndex: 2,
        }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    ) : null;

  return (
    <Box sx={{ bgcolor: "var(--color-background)", color: "var(--color-text-primary)", minHeight: "100vh", py: 6 }}>
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2, md: 4 },
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <Box
          sx={{
            borderRadius: 4,
            overflow: "hidden",
            position: "relative",
            minHeight: 320,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            border: "1px solid var(--color-border)",
          }}
        >
          {renderEditButton("hero")}
          <Box
            component="img"
            src={hero.image}
            alt={hero.alt || hero.title}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <Box sx={{ p: { xs: 3, md: 4 }, display: "flex", flexDirection: "column", gap: 2, bgcolor: "#ffffff" }}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              {hero.title}
            </Typography>
            <Typography sx={{ color: "var(--color-text-secondary)" }}>{hero.subtitle}</Typography>
            <Button
              href={hero.ctaUrl || "/blog"}
              variant="contained"
              sx={{ alignSelf: "flex-start", borderRadius: 2, textTransform: "none", bgcolor: "var(--color-primary)" }}
            >
              {hero.ctaText || "Read more"}
            </Button>
          </Box>
        </Box>

        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Latest Posts
            </Typography>
            {renderEditButton("posts")}
          </Box>
          <Grid container spacing={3} justifyContent="center">
            {posts.map((post) => {
              const slug = post.slug
                ? post.slug.startsWith("/blog")
                  ? post.slug
                  : `/blog/${post.slug.replace(/^\//, "")}`
                : post.id
                ? `/blog/${post.id}`
                : "#";
              return (
                <Grid
                  key={post.id || post.title}
                  sx={{ display: "flex", justifyContent: "center" }}
                  size={{
                    xs: 12,
                    sm: 6,
                    md: 4
                  }}>
                  <Card
                    sx={{
                      width: "100%",
                      minWidth: 0,
                      maxWidth: 300,
                      height: 500,
                      borderRadius: 3,
                      bgcolor: "#ffffff",
                      border: "1px solid var(--color-border)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <CardActionArea
                      component={slug !== "#" ? LinkWrapper : "div"}
                      href={slug}
                      sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch", color: "var(--color-text-primary)" }}
                    >
                      {post.image && (
                        <CardMedia component="img" height="180" image={post.image} alt={post.alt || post.title} sx={{ objectFit: "cover" }} />
                      )}
                      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {post.tags?.slice(0, 2).map((tag) => (
                            <Chip key={tag} label={tag} size="small" color="primary" />
                          ))}
                          <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                            {post.date}
                          </Typography>
                        </Stack>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: "var(--color-text-primary)", lineHeight: 1.25 }}>
                          {post.title}
                        </Typography>
                        <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{post.excerpt}</Typography>
                        <Typography variant="caption" sx={{ color: "var(--color-primary)", mt: "auto" }}>
                          By {post.author || "Team"}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}

function LinkWrapper({ href, ...rest }) {
  // simple wrapper to avoid Next.js Link import here
  return <a href={href} {...rest} />;
}
