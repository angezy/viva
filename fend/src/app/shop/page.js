
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { addToCart, fetchSession } from "../lib/apiClient";
import { toast } from "../lib/notifications";
import { ProductGridSkeleton } from "../components/LoadingSkeletons";

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

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productHref(product, title) {
  const explicitSlug = product.slug || product.Slug || product.handle || product.Handle;
  const normalizedSlug = String(explicitSlug || "")
    .replace(/^\/product\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "");
  return `/product/${encodeURIComponent(slugify(normalizedSlug || title))}`;
}

function ShopProductCard({ product, title, description, price, image, trending = false, onAdd, adding = false }) {
  return (
    <Card
      sx={{
        ...(trending ? { flex: "0 0 260px", minHeight: 390 } : { width: 300, minWidth: 300, maxWidth: 300, height: 500 }),
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: "#ffffff",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border)",
        boxShadow: trending ? "0 16px 40px rgba(43,43,43,0.08)" : "0 20px 50px rgba(43,43,43,0.08)",
        display: "flex",
        flexDirection: "column",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 20px 42px rgba(43,43,43,0.13)" },
      }}
    >
      <Box component={Link} href={productHref(product, title)} sx={{ display: "flex", flex: 1, flexDirection: "column", color: "inherit", textDecoration: "none", "&:focus-visible": { outline: "3px solid var(--color-primary-light)", outlineOffset: -3 } }} aria-label={`View ${title}`}>
        <CardMedia component="img" height={trending ? 180 : 220} image={image} alt={title} sx={{ objectFit: "cover" }} />
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minHeight: trending ? 190 : 210 }}>
          {trending && <Chip label="Trending" size="small" sx={{ alignSelf: "flex-start", mb: 1.5, backgroundColor: "var(--color-accent-soft)", color: "var(--color-accent-dark)", fontWeight: 700 }} />}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", mb: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {description}
          </Typography>
          <Typography variant="h6" color="primary.main" sx={{ mt: "auto", fontWeight: 800 }}>
            ${price.toFixed ? price.toFixed(2) : price}
          </Typography>
        </CardContent>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        <Button fullWidth variant="contained" color="primary" size={trending ? "small" : "medium"} sx={{ borderRadius: 999 }} onClick={() => onAdd(product)} disabled={adding} data-button-loading-managed="true" startIcon={adding ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {adding ? "Adding..." : "Add to Cart"}
        </Button>
      </Box>
    </Card>
  );
}

export default function ShopPage({ initialContent = null, editable = false, onEdit = {} }) {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sessionUser, setSessionUser] = useState(null);
  const [pageContent, setPageContent] = useState(initialContent || DEFAULT_SHOP_CONTENT);
  const [addingProductId, setAddingProductId] = useState(null);

  useEffect(() => {
    if (initialContent) {
      queueMicrotask(() => setPageContent(initialContent));
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
    queueMicrotask(() => setSearch(query));
  }, []);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => setProductsLoading(true));
    fetch("/api/shop")
      .then((res) => res.json())
      .then((data) => {
        if (mounted) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error fetching products:", err))
      .finally(() => {
        if (mounted) setProductsLoading(false);
      });
    return () => {
      mounted = false;
    };
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
    const productId = product.id ?? product.PID ?? product.ProductId ?? title;
    const price = typeof product.price === "number" ? product.price : Number(product.Price) || 0;
    const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
    const image = firstImage || product.Img || product.IMG || product.img || product.image || product.imageUrl ||
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80";
    setAddingProductId(String(productId));
    try {
      await addToCart({
        productId,
        title,
        price: Number(price) || 0,
        image,
        quantity: 1,
      });
      toast.success("Added to cart", {
        description: `${title} is now in your cart.`,
        action: { label: "View cart", onClick: () => router.push("/cart") },
        cancel: { label: "Continue shopping" },
      });
    } catch (err) {
      if (err.message === "unauthorized") {
        setSessionUser(null);
        toast.info("Cart session expired", { description: "Please try adding the item again." });
      } else {
        toast.error("Could not add item", { description: err.message || "Please try again." });
      }
    } finally {
      setAddingProductId(null);
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
    <Box sx={{ backgroundColor: "var(--color-background)", minHeight: "100vh", color: "var(--color-text-primary)" }}>
      <Box
        sx={{
          position: "relative",
          backgroundImage: `linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.15)), url("${hero.backgroundImage}")`,
          backgroundSize: "cover",
          backgroundPosition: hero.backgroundPosition || "center",
          py: { xs: 8, md: 10 },
          textAlign: "center",
          color: "#ffffff",
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
                backgroundColor: "#ffffff",
                borderRadius: 2,
                input: { color: "var(--color-text-primary)" },
                fieldset: { borderColor: "var(--color-border)" },
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
        {trendingProducts.length > 0 && (
          <Box component="section" aria-labelledby="trending-collection-title" sx={{ mb: 7 }}>
            <Typography id="trending-collection-title" variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
              Trending collection
            </Typography>
            <Typography variant="body1" sx={{ color: "var(--color-text-secondary)", mb: 3 }}>
              The pieces everyone is talking about right now.
            </Typography>
            <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", lg: "center" }, gap: 2, overflowX: "auto", pb: 2, scrollbarWidth: "thin" }}>
              {trendingProducts.map((product) => {
                const title = product.name || product.Name || product.title || "Untitled";
                const description = product.Description || product.description || "No description available.";
                const price = typeof product.price === "number" ? product.price : Number(product.Price) || 0;
                const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
                const image = firstImage || product.Img || product.IMG || product.img || product.image || product.imageUrl ||
                  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80";
                const productId = product.id ?? product.PID ?? product.ProductId ?? title;
                return <ShopProductCard key={`trending-${productId}`} product={product} title={title} description={description} price={price} image={image} trending onAdd={handleAddProduct} adding={addingProductId === String(productId)} />;
              })}
            </Box>
          </Box>
        )}

        <Box id="browse-products" sx={{ scrollMarginTop: 24 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
          {shopContent.catalogTitle || DEFAULT_SHOP_CONTENT.catalogTitle}
        </Typography>
        {productsLoading ? (
          <ProductGridSkeleton count={8} cardHeight={500} imageHeight={220} columns={3} gridSpacing={3} />
        ) : visibleProducts.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            {shopContent.emptyMessage || DEFAULT_SHOP_CONTENT.emptyMessage}
          </Typography>
        ) : (
          <Grid container spacing={3} justifyContent="center">
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

              const productId = product.id ?? product.PID ?? product.ProductId ?? title;
              return (
                <Grid
                  key={productId}
                  size={{
                    xs: 12,
                    sm: 6,
                    md: 4
                  }}><ShopProductCard product={product} title={title} description={description} price={price} image={image} onAdd={handleAddProduct} adding={addingProductId === String(productId)} /></Grid>
              );
            })}
          </Grid>
        )}
        </Box>
      </Container>
    </Box>
  );
}
