
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
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { addToCart, fetchSession } from "../lib/apiClient";
import { toast } from "../lib/notifications";

const DEFAULT_SHOP_CONTENT = {
  hero: {
    title: "Shop the Collection",
    description: "Discover curated essentials, trending drops, and limited releases tailored to your lifestyle.",
    backgroundImage:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80",
    backgroundPosition: "center",
  },
  searchPlaceholder: "Search products",
  ctaText: "Start Shopping",
  catalogTitle: "Browse products",
  emptyMessage: "No products match your search.",
};

export default function ShopPage({ initialContent = null, editable = false, onEdit = {} }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sessionUser, setSessionUser] = useState(null);
  const [pageContent, setPageContent] = useState(initialContent || DEFAULT_SHOP_CONTENT);

  useEffect(() => {
    if (initialContent) {
      setPageContent(initialContent);
      return undefined;
    }

    let mounted = true;
    fetch("/api/dashboard/shop")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setPageContent(data))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [initialContent]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("search") || "";
    setSearch(query);
  }, []);

  useEffect(() => {
    fetch("/api/shop")
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

  const shopContent = pageContent || DEFAULT_SHOP_CONTENT;
  const hero = { ...DEFAULT_SHOP_CONTENT.hero, ...(shopContent.hero || {}) };

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const title = product.name || product.Name || product.title || "";
      const matchesSearch = title.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [products, search]);

  const trendingProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const title = product.name || product.Name || product.title || "";
      return Boolean(product.isTrending ?? product.IsTrending ?? product.trending ?? product.Trending) &&
        (!query || title.toLowerCase().includes(query));
    });
  }, [products, search]);

  async function handleAddProduct(product) {
    const title = product.name || product.Name || product.title || "Untitled";
    const price = typeof product.price === "number" ? product.price : Number(product.Price) || 0;
    const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
    const image = firstImage || product.Img || product.IMG || product.img || product.image || product.imageUrl ||
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80";
    try {
      await addToCart({
        productId: product.id ?? product.PID ?? product.ProductId ?? title,
        title,
        price: Number(price) || 0,
        image,
        quantity: 1,
      });
      toast.success("Added to cart", {
        description: `${title} is now in your cart.`,
        action: { label: "View cart", onClick: () => { window.location.href = "/cart"; } },
        cancel: { label: "Continue shopping" },
      });
    } catch (err) {
      if (err.message === "unauthorized") {
        setSessionUser(null);
        toast.info("Cart session expired", { description: "Please try adding the item again." });
      } else {
        toast.error("Could not add item", { description: err.message || "Please try again." });
      }
    }
  }

  const editButton = (section, label) =>
    editable && typeof onEdit[section] === "function" ? (
      <IconButton
        aria-label={`Edit ${label}`}
        onClick={() => onEdit[section]()}
        size="small"
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          color: "#fff",
          backgroundColor: "rgba(15,23,42,0.72)",
          zIndex: 2,
          "&:hover": { backgroundColor: "rgba(15,23,42,0.95)" },
        }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    ) : null;

  return (
    <Box sx={{ backgroundColor: "#050714", minHeight: "100vh", color: "#fff" }}>
      <Box
        sx={{
          position: "relative",
          backgroundImage: `linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.15)), url("${hero.backgroundImage}")`,
          backgroundSize: "cover",
          backgroundPosition: hero.backgroundPosition || "center",
          py: { xs: 8, md: 10 },
          textAlign: "center",
          color: "#fff",
        }}
      >
        {editButton("hero", "shop hero")}
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
            {hero.title || DEFAULT_SHOP_CONTENT.hero.title}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8, mb: 4 }}>
            {hero.description || DEFAULT_SHOP_CONTENT.hero.description}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <TextField
              placeholder={shopContent.searchPlaceholder || DEFAULT_SHOP_CONTENT.searchPlaceholder}
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
            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{ borderRadius: 999 }}
              onClick={() => document.getElementById("shop-catalog")?.scrollIntoView({ behavior: "smooth" })}
            >
              {shopContent.ctaText || DEFAULT_SHOP_CONTENT.ctaText}
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container id="shop-catalog" maxWidth="lg" sx={{ py: 6, position: "relative" }}>
        {editButton("catalog", "shop catalog")}
        <Box component="section" aria-labelledby="trending-collection-title" sx={{ mb: 7 }}>
          <Typography id="trending-collection-title" variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Trending collection
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.68)", mb: 3 }}>
            The pieces everyone is talking about right now.
          </Typography>
          {trendingProducts.length === 0 ? (
            <Box sx={{ border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 3, p: 3, color: "rgba(255,255,255,0.65)" }}>
              Trending products will appear here when they are selected in the product editor.
            </Box>
          ) : (
            <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2, scrollbarWidth: "thin" }}>
              {trendingProducts.map((product) => {
                const title = product.name || product.Name || product.title || "Untitled";
                const description = product.Description || product.description || "No description available.";
                const price = typeof product.price === "number" ? product.price : Number(product.Price) || 0;
                const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
                const image = firstImage || product.Img || product.IMG || product.img || product.image || product.imageUrl ||
                  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80";
                return (
                  <Card key={`trending-${product.id ?? product.PID ?? title}`} sx={{ flex: "0 0 260px", minHeight: 390, borderRadius: 4, overflow: "hidden", background: "linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,0.9))", color: "#fff", border: "1px solid rgba(45,212,191,0.28)", boxShadow: "0 16px 40px rgba(2,6,23,0.45)" }}>
                    <CardMedia component="img" height="180" image={image} alt={title} sx={{ objectFit: "cover" }} />
                    <CardContent sx={{ minHeight: 210, display: "flex", flexDirection: "column" }}>
                      <Chip label="Trending" size="small" sx={{ alignSelf: "flex-start", mb: 1.5, backgroundColor: "#0f766e", color: "#fff", fontWeight: 700 }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.68)", mb: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {description}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: "auto" }}>
                        <Typography variant="h6" color="primary.light">${price.toFixed ? price.toFixed(2) : price}</Typography>
                        <Button variant="contained" color="primary" size="small" sx={{ borderRadius: 999 }} onClick={() => handleAddProduct(product)}>
                          Add
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>

        <Box id="browse-products" sx={{ scrollMarginTop: 24 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
          {shopContent.catalogTitle || DEFAULT_SHOP_CONTENT.catalogTitle}
        </Typography>
        {visibleProducts.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            {shopContent.emptyMessage || DEFAULT_SHOP_CONTENT.emptyMessage}
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
                <Button variant="contained" color="primary" sx={{ borderRadius: 999 }} onClick={() => handleAddProduct(product)}>
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
        </Box>
      </Container>
    </Box>
  );
}
