"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditIcon from "@mui/icons-material/Edit";
import Link from "next/link";

const FALLBACK = {
  heroCards: [
    {
      title: "Nova One Smart Bottle",
      subtitle: "Keeps water cold for 24 hours, tracks your intake automatically.",
      image:
        "https://images.unsplash.com/photo-1526402462921-3c62b6d1f1ab?auto=format&fit=crop&w=1200&q=80",
    },
    {
      title: "Launch Bundle - Save 20%",
      subtitle: "One bottle, two filters, and a travel sleeve in the box.",
      highlights: [
        "Keeps cold 24 hours, hot 12 hours",
        "Leak-proof lid with one-handed sip",
        "Hydration reminders in the companion app",
      ],
      cta: "Preorder now",
    },
  ],
  trainingBlock: {
    image:
      "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=900&q=80",
    title: "Engineered for daily carry.",
    copy:
      "Double-wall stainless steel, leak-proof lid, and smart tracking so you never miss a sip.",
    cta: "See specs",
  },
  bannerText: "Free shipping - 30 day returns - 2 year warranty",
  products: [],
  actionShots: [
    {
      src: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=600&q=80",
      alt: "Nova bottle with water filter",
    },
    {
      src: "https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&q=80",
      alt: "Bottle on a desk next to laptop",
    },
    {
      src: "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=600&q=80",
      alt: "Closeup of stainless steel bottle",
    },
    {
      src: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80",
      alt: "Traveler packing bottle in bag",
    },
  ],
  welcome: {
    headline: "Meet Nova One",
    title: "The smarter way to hydrate.",
    copy: "Tracks intake, keeps drinks cold or hot, and syncs with your phone so you always know when to sip.",
    cta: "Preorder today",
    image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=80",
  },
  reviews: {
    headline: "Early adopters love Nova One",
    ratingText: "Average rating 4.9 / 5.0",
  },
  features: [
    { title: "Temp control", copy: "Keeps drinks cold 24 hours or hot for 12." },
    { title: "Smart reminders", copy: "Paired app nudges you when it's time to sip." },
    { title: "Leak-proof", copy: "One-handed lid with a lock for your bag." },
    { title: "2-year warranty", copy: "Free returns within 30 days and dedicated support." },
  ],
  menus: {
    main: ["Home", "Specs", "FAQ", "Support"],
    footerTitle: "Stay hydrated with Nova",
  },
};

export default function HeroSection({ initialContent = null, onEdit = {} }) {
  const [content, setContent] = useState(initialContent);
  const [productsFromDb, setProductsFromDb] = useState(null);

  // Keep local state in sync with provided content (dashboard view)
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

  // Fetch when no content provided (public site)
  useEffect(() => {
    if (initialContent) return;
    let mounted = true;
    fetch("/api/dashboard/home")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (mounted) setContent(data);
      })
      .catch(() => {
        if (mounted) setContent(FALLBACK);
      });
    return () => {
      mounted = false;
    };
  }, [initialContent]);

  // Load products from backend DB for live site
  useEffect(() => {
    let mounted = true;
    fetch("http://localhost:5000/api/shop")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setProductsFromDb(data);
        }
      })
      .catch(() => {
        if (mounted) setProductsFromDb(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const data = content || FALLBACK;
  const heroCards = Array.isArray(data.heroCards) && data.heroCards.length ? data.heroCards : FALLBACK.heroCards;
  const trainingBlock = data.trainingBlock || FALLBACK.trainingBlock;
  const productsSource = Array.isArray(productsFromDb) && productsFromDb.length ? productsFromDb : data.products;
  const products = Array.isArray(productsSource) && productsSource.length ? productsSource : FALLBACK.products;
  const actionShotsRaw = Array.isArray(data.actionShots) && data.actionShots.length ? data.actionShots : FALLBACK.actionShots;
  const actionShots = actionShotsRaw.map((item, idx) => {
    if (typeof item === "string") {
      const isVideo = item.endsWith(".mp4") || item.endsWith(".webm");
      return isVideo
        ? { video: item, poster: "", alt: `Action ${idx + 1}` }
        : { src: item, alt: `Action shot ${idx + 1}` };
    }
    return item;
  });
  const features = Array.isArray(data.features) && data.features.length ? data.features : FALLBACK.features;
  const welcome = data.welcome || FALLBACK.welcome;
  const reviews = data.reviews || FALLBACK.reviews;
  const menus = data.menus || FALLBACK.menus;
  const firstCard = heroCards[0] || FALLBACK.heroCards[0];
  const secondCard = heroCards[1] || FALLBACK.heroCards[1];
  const highlights = Array.isArray(secondCard?.highlights) ? secondCard.highlights : [];

  const renderEditButton = (key) =>
    onEdit[key] ? (
      <IconButton
        size="small"
        onClick={onEdit[key]}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "rgba(0,0,0,0.5)",
          color: "white",
          "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
          zIndex: 2,
        }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    ) : null;

  return (
    <Box
      sx={{
        bgcolor: "#03050b",
        color: "#f6f8ff",
        minHeight: "100vh",
        fontFamily: "'Space Grotesk','Segoe UI',sans-serif",
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 4 }, py: 6 }}>
        <Box
          sx={{
            bgcolor: "#2563eb",
            color: "white",
            borderRadius: 2,
            px: 3,
            py: 1.5,
            textAlign: "center",
            fontWeight: 700,
            letterSpacing: 1,
            mb: 3,
            position: "relative",
          }}
        >
          {renderEditButton("banner")}
          {data.bannerText || FALLBACK.bannerText}
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                bgcolor: "#0a0f1c",
                border: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {renderEditButton("hero1")}
              <CardMedia
                component="img"
                height="320"
                image={firstCard.image}
                alt={firstCard.alt || firstCard.title}
                sx={{ objectFit: "cover" }}
              />
              <CardContent>
                <Typography variant="overline" color="primary.light">
                  {firstCard.subtitle}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {firstCard.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                bgcolor: "#0f1628",
                border: "1px solid rgba(255,255,255,0.08)",
                p: 3,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                position: "relative",
              }}
            >
              {renderEditButton("hero2")}
              <Chip
                label="Limited Release"
                color="primary"
                sx={{ alignSelf: "flex-start", fontWeight: 700 }}
              />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {secondCard.title}
              </Typography>
              <Typography color="rgba(255,255,255,0.7)">
                {secondCard.subtitle}
              </Typography>
              <Stack spacing={1}>
                {highlights.map((line) => (
                  <Typography
                    key={line}
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    • {line}
                  </Typography>
                ))}
              </Stack>
              <Button
                variant="contained"
                size="large"
                sx={{
                  mt: "auto",
                  bgcolor: "#2563eb",
                  fontWeight: 700,
                  textTransform: "none",
                  borderRadius: 2,
                  ":hover": { bgcolor: "#1d4ed8" },
                }}
              >
                {secondCard.cta || "Shop now"}
              </Button>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ my: 4 }}>
          <Card
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "#0a0f1c",
              position: "relative",
            }}
          >
            {renderEditButton("training")}
            <CardMedia
              component="img"
                image={trainingBlock.image}
                alt={trainingBlock.alt || "Training"}
                sx={{ height: { xs: 260, md: "100%" }, objectFit: "cover" }}
              />
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography
                variant="h5"
                sx={{ fontWeight: 900, mb: 1, color: "#60a5fa" }}
              >
                {trainingBlock.title}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.78)" }}>
                {trainingBlock.copy}
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{
                  mt: 3,
                  bgcolor: "#2563eb",
                  borderRadius: 2,
                  textTransform: "none",
                  ":hover": { bgcolor: "#1d4ed8" },
                }}
              >
                {trainingBlock.cta || "See specs"}
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Box
          sx={{
            bgcolor: "#0f1628",
            borderRadius: 3,
            px: 3,
            py: 2,
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "center",
            mb: 3,
          }}
        >
          <Typography variant="body2" color="rgba(255,255,255,0.75)">
            New drops land every Monday · Build your stack and save more on
            bundles
          </Typography>
        </Box>

        <Box sx={{ mb: 5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Products
          </Typography>
          <Grid container spacing={2}>
            {products.length === 0 && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    borderRadius: 2,
                    p: 3,
                    bgcolor: "rgba(255,255,255,0.04)",
                    border: "1px dashed rgba(255,255,255,0.1)",
                    textAlign: "center",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  No products found. Add products in the dashboard to see them here.
                </Box>
              </Grid>
            )}
            {products.map((item, idx) => {
              const title = item.title || item.name || `Product ${idx + 1}`;
              const img = item.image || item.img || (Array.isArray(item.images) ? item.images[0] : null);
              const rawPrice = item.price ?? item.Price ?? "";
              const price =
                typeof rawPrice === "number"
                  ? `$${rawPrice.toFixed(2)}`
                  : typeof rawPrice === "string" && rawPrice.trim().length
                  ? rawPrice
                  : "";
              const alt = item.alt || item.name || title;
              return (
                <Grid item xs={12} sm={6} md={3} key={title}>
                  <Card
                    sx={{
                      borderRadius: 2.5,
                      overflow: "hidden",
                      bgcolor: "#0a0f1c",
                      border: "1px solid rgba(255,255,255,0.08)",
                      position: "relative",
                    }}
                  >
                    {renderEditButton("products")}
                    <CardMedia
                      component="img"
                      height="180"
                      image={img || "https://placehold.co/400x300?text=Product"}
                      alt={alt}
                      sx={{ objectFit: "cover" }}
                    />
                    <CardContent>
                      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
                      <Typography color="primary.light">{price}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, mb: 2, textAlign: "center" }}
          >
            See Action...
          </Typography>
          <Grid container spacing={2}>
            {actionShots.map((shot, idx) => {
              const isVideo = !!shot.video || (shot.src && (shot.src.endsWith(".mp4") || shot.src.endsWith(".webm")));
              return (
                <Grid item xs={12} sm={6} md={3} key={`${shot.video || shot.src || "action"}-${idx}`}>
                  <Box
                    sx={{
                      position: "relative",
                      borderRadius: 2,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.08)",
                      bgcolor: "#0a0f1c",
                      height: 220,
                    }}
                  >
                    {idx === 0 && renderEditButton("actionShots")}
                    {isVideo ? (
                      <Box
                        component="video"
                        src={shot.video || shot.src}
                        poster={shot.poster || shot.src}
                        muted
                        loop
                        controls
                        playsInline
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          backgroundColor: "black",
                        }}
                        aria-label={shot.alt || `Action video ${idx + 1}`}
                      />
                    ) : (
                      <Box
                        component="img"
                        src={shot.src}
                        alt={shot.alt || `Action ${idx + 1}`}
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                    {!isVideo && (
                      <Box
                        sx={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "rgba(0,0,0,0.25)",
                          color: "white",
                        }}
                      >
                        <PlayArrowIcon />
                      </Box>
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <Grid container spacing={3} alignItems="stretch" sx={{ mb: 4 }}>
          <Grid item xs={12} md={7}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                position: "relative",
              }}
            >
              {renderEditButton("welcome")}
              <Box sx={{ position: "relative" }}>
                <CardMedia
                  component="img"
                  image={welcome.image}
                  alt={welcome.alt || "Welcome"}
                  sx={{ height: "100%", objectFit: "cover" }}
                />
              </Box>
              <CardContent sx={{ p: 3, bgcolor: "#2563eb" }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  {welcome.headline || "Welcome to"}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
                  {welcome.title}
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.9)", mb: 2 }}>
                  {welcome.copy}
                </Typography>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: "#0f172a",
                    borderRadius: 2,
                    textTransform: "none",
                    ":hover": { bgcolor: "#0b1220" },
                  }}
                >
                  {welcome.cta || "Join Now"}
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={5}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.08)",
                bgcolor: "#0a0f1c",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                gap: 1,
                p: 3,
                position: "relative",
              }}
            >
              {renderEditButton("reviews")}
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {reviews.headline}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} sx={{ color: "#facc15" }} />
                ))}
              </Stack>
              <Typography color="rgba(255,255,255,0.7)">
                {reviews.ratingText}
              </Typography>
            </Card>
          </Grid>
        </Grid>

        <Box
          sx={{
            bgcolor: "#2563eb",
            borderRadius: 3,
            p: 3,
            mb: 5,
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}
        >
          {renderEditButton("features")}
          <Typography
            variant="h6"
            sx={{ fontWeight: 900, textAlign: "center", mb: 2 }}
          >
            Train Better. Shop Smarter.
          </Typography>
          <Grid container spacing={2}>
            {features.map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item.title}>
                <Card
                  sx={{
                    borderRadius: 2,
                    bgcolor: "rgba(15,23,42,0.2)",
                    height: "100%",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <CardContent>
                    <Typography sx={{ fontWeight: 800 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
                      {item.copy}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Footer section removed per request */}
      </Box>
    </Box>
  );
}

