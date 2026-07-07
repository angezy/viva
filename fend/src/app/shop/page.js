
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Box,
  Chip,
  Stack,
  TextField,
} from "@mui/material";
import { addToCart, fetchSession } from "../lib/apiClient";

const HERO_BG =
  "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.15)), url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80')";

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sessionUser, setSessionUser] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/shop")
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  useEffect(() => {
    fetchSession()
      .then((session) => {
        if (session?.user) setSessionUser(session.user);
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || p.Category).filter(Boolean));
    return ["all", ...Array.from(set).slice(0, 6)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const title = product.name || product.Name || product.title || "";
      const matchesSearch = title.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeFilter === "all" || (product.category || product.Category) === activeFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, activeFilter]);

  return (
    <Box sx={{ backgroundColor: "#050714", minHeight: "100vh", color: "#fff" }}>
      <Box
        sx={{
          backgroundImage: HERO_BG,
          backgroundSize: "cover",
          backgroundPosition: "center",
          py: { xs: 8, md: 10 },
          textAlign: "center",
          color: "#fff",
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
            Shop the Collection
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8, mb: 4 }}>
            Discover curated essentials, trending drops, and limited releases tailored to your lifestyle.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <TextField
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              variant="outlined"
              sx={{
                minWidth: { xs: "100%", sm: 320 },
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 2,
                input: { color: "#fff" },
                fieldset: { border: "none" },
              }}
            />
            <Button variant="contained" color="primary" size="large" sx={{ borderRadius: 999 }}>
              Start Shopping
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 4 }}>
          {categories.map((category) => (
            <Chip
              key={category}
              label={category === "all" ? "All" : category}
              clickable
              color={activeFilter === category ? "primary" : "default"}
              onClick={() => setActiveFilter(category)}
              sx={{ textTransform: "capitalize" }}
            />
          ))}
        </Stack>
        {visibleProducts.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            No products match your search.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {visibleProducts.map((product) => {
              const title = product.name || product.Name || product.title || "Untitled";
              const description = product.Description || product.description || "No description available.";
              const price =
                typeof product.price === "number"
                  ? product.price
                  : typeof product.Price === "number"
                  ? product.Price
                  : 0;
              const firstImage =
                Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
              const image =
                firstImage ||
                product.Img ||
                product.IMG ||
                product.img ||
                product.image ||
                product.imageUrl ||
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80";

              async function handleAdd() {
                setNotice("");
                try {
                  const payload = {
                    productId: product.id ?? product.PID ?? product.ProductId ?? title,
                    title,
                    price: Number(price) || 0,
                    image,
                    quantity: 1,
                  };
                  const session = sessionUser || (await fetchSession());
                  if (!session) {
                    setNotice("Please sign in to add items to your cart.");
                    return;
                  }
                  if (!sessionUser && session?.user) setSessionUser(session.user);
                  await addToCart(payload);
                  setNotice(`${title} added to cart`);
                } catch (err) {
                  if (err.message === "unauthorized") {
                    setSessionUser(null);
                    setNotice("Please sign in to add items to your cart.");
                  } else {
                    setNotice(err.message || "Could not add item");
                  }
                }
              }

              return (
                <Grid item xs={12} sm={6} md={4} key={product.id ?? product.PID ?? title}>
                  <Card
                    sx={{
                      width: 300,
                      minWidth: 300,
                      maxWidth: 300,
                      height: 500,
                      borderRadius: 4,
                      overflow: "hidden",
                      background: "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,0.9))",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.05)",
                      boxShadow: "0 20px 50px rgba(2,6,23,0.6)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CardMedia component="img" height="220" image={image} alt={title} sx={{ objectFit: "cover" }} />
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2 }}>
                {description}
              </Typography>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: "auto" }}>
                <Typography variant="h6" color="primary.light">
                  ${price.toFixed ? price.toFixed(2) : price}
                </Typography>
                <Button variant="contained" color="primary" sx={{ borderRadius: 999 }} onClick={handleAdd}>
                  Add to Cart
                </Button>
              </Stack>
            </CardContent>
          </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
      {notice && (
        <Container sx={{ pb: 4 }}>
          <Card sx={{ p: 2, borderRadius: 2, bgcolor: "#0f172a", color: "rgba(255,255,255,0.85)" }}>
            {notice}
          </Card>
        </Container>
      )}
    </Box>
  );
}
