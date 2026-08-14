"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { addToCart } from "../../lib/apiClient";
import { toast } from "../../lib/notifications";
import { rememberProduct } from "../../lib/recentProducts";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^\/product\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function getProductSlug(product) {
  const explicitSlug = product.slug || product.Slug || product.handle || product.Handle;
  return normalizeSlug(explicitSlug || slugify(product.name || product.Name || product.title));
}

function getImageValue(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return String(value.url || value.imageUrl || value.src || value.path || "").trim();
  }
  return "";
}

function normalizeProduct(product = {}) {
  const title = product.name || product.Name || product.title || "Untitled product";
  const rawImages = Array.isArray(product.images) ? product.images : [];
  const images = [
    ...rawImages,
    product.img,
    product.Img,
    product.IMG,
    product.image,
    product.imageUrl,
    product.imageURL,
  ]
    .map(getImageValue)
    .filter(Boolean);
  const uniqueImages = [...new Set(images)];
  const rawPrice = product.price ?? product.Price ?? 0;
  const rawStock = product.stock ?? product.Stock ?? product.quantity ?? product.Quantity;
  const numericPrice = Number(rawPrice);
  const numericStock = rawStock === undefined || rawStock === null || rawStock === "" ? null : Number(rawStock);

  return {
    id: product.id ?? product.PID ?? product.ProductId ?? product.productId ?? title,
    slug: getProductSlug(product),
    title,
    description: product.description || product.Description || "No description available.",
    category: product.category || product.Category || "Collection",
    brand: product.brand || product.Brand || "Weluxo",
    price: Number.isFinite(numericPrice) ? numericPrice : 0,
    stock: Number.isFinite(numericStock) ? numericStock : null,
    alt: product.alt || product.Alt || title,
    address: product.address || product.Address || "",
    images: uniqueImages.length ? uniqueImages : [FALLBACK_IMAGE],
  };
}

function ProductLoading() {
  return (
    <Box sx={{ backgroundColor: "#050714", minHeight: "100vh", color: "white", py: 6 }}>
      <Container maxWidth="lg">
        <Skeleton variant="text" width={220} height={30} sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
        <Grid container spacing={5} sx={{ mt: 1 }}>
          <Grid item xs={12} md={7}>
            <Skeleton
              variant="rounded"
              height={520}
              sx={{ bgcolor: "rgba(255,255,255,0.08)", borderRadius: 4 }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Skeleton variant="text" height={56} sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
            <Skeleton variant="text" width="40%" sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
            <Skeleton variant="rounded" height={180} sx={{ mt: 3, bgcolor: "rgba(255,255,255,0.08)" }} />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function ProductNotFound({ error }) {
  return (
    <Container sx={{ py: 8 }}>
      <Card sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Product not found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {error || "This product may have been removed or the link may be out of date."}
        </Typography>
        <Button component={Link} href="/shop" variant="contained" sx={{ borderRadius: 999 }}>
          Back to shop
        </Button>
      </Card>
    </Container>
  );
}

export default function ProductPage() {
  const params = useParams();
  const requestedSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const normalizedRequestedSlug = normalizeSlug(requestedSlug);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/shop", { cache: "no-store" });
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data?.error || "Unable to load product details.");
        if (active) setCatalog(Array.isArray(data) ? data : []);
      } catch (error) {
        if (active) setLoadError(error.message || "Unable to load product details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const products = useMemo(() => catalog.map(normalizeProduct), [catalog]);
  const product = useMemo(
    () =>
      products.find(
        (item) => item.slug === normalizedRequestedSlug || String(item.id) === String(normalizedRequestedSlug)
      ),
    [normalizedRequestedSlug, products]
  );

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter((item) => item.slug !== product.slug && item.category === product.category)
      .slice(0, 4);
  }, [product, products]);

  useEffect(() => {
    setSelectedImage(0);
    setQuantity(1);
  }, [product?.slug]);

  useEffect(() => {
    if (product) rememberProduct(product);
  }, [product]);

  async function handleAddToCart() {
    if (!product || product.stock === 0) return;
    setAdding(true);
    try {
      await addToCart({
        productId: product.id,
        title: product.title,
        price: product.price,
        image: product.images[0],
        quantity,
      });
      toast.success("Added to cart", {
        description: `${product.title} is now in your cart.`,
        action: { label: "View cart", onClick: () => { window.location.href = "/cart"; } },
        cancel: { label: "Continue shopping" },
      });
    } catch (error) {
      const isUnauthorized = error.message === "unauthorized";
      (isUnauthorized ? toast.info : toast.error)(isUnauthorized ? "Cart session expired" : "Could not add item", {
        description: isUnauthorized ? "Please try adding the item again." : error.message || "Please try again.",
      });
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <ProductLoading />;
  if (!product) return <ProductNotFound error={loadError} />;

  const inStock = product.stock === null || product.stock > 0;
  const currentImage = product.images[selectedImage] || product.images[0];

  return (
    <Box sx={{ backgroundColor: "#050714", minHeight: "100vh", color: "white", py: 5 }}>
      <Container maxWidth="lg">
        <Breadcrumbs sx={{ mb: 4, color: "rgba(255,255,255,0.65)" }}>
          <Link href="/shop">Shop</Link>
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          <Typography color="white">{product.title}</Typography>
        </Breadcrumbs>

        <Grid container spacing={5}>
          <Grid item xs={12} md={7}>
            <Card sx={{ overflow: "hidden", borderRadius: 4, bgcolor: "#0f172a" }}>
              <Box
                component="img"
                src={currentImage}
                alt={product.alt}
                sx={{ display: "block", width: "100%", height: { xs: 320, md: 520 }, objectFit: "cover" }}
              />
            </Card>
            {product.images.length > 1 && (
              <Stack direction="row" spacing={1.5} sx={{ mt: 2, overflowX: "auto", pb: 1 }}>
                {product.images.map((image, index) => (
                  <Box
                    component="button"
                    type="button"
                    key={`${image}-${index}`}
                    onClick={() => setSelectedImage(index)}
                    aria-label={`View product image ${index + 1}`}
                    sx={{
                      border: index === selectedImage ? "2px solid #60a5fa" : "2px solid transparent",
                      borderRadius: 2,
                      p: 0,
                      width: 80,
                      height: 80,
                      overflow: "hidden",
                      cursor: "pointer",
                      flexShrink: 0,
                      bgcolor: "#0f172a",
                    }}
                  >
                    <Box component="img" src={image} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Box>
                ))}
              </Stack>
            )}
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={product.category} color="secondary" size="small" />
                {product.brand && <Chip label={product.brand} variant="outlined" size="small" sx={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }} />}
              </Stack>
              <Typography variant="h2" component="h1" sx={{ fontWeight: 900, fontSize: { xs: "2.25rem", md: "3.25rem" }, lineHeight: 1.05 }}>
                {product.title}
              </Typography>
              <Typography variant="h4" color="primary.light" sx={{ fontWeight: 800 }}>
                ${product.price.toFixed(2)}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.75 }}>
                {product.description}
              </Typography>

              <Card sx={{ bgcolor: "rgba(15,23,42,0.9)", color: "white", border: "1px solid rgba(255,255,255,0.08)" }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography color="rgba(255,255,255,0.7)">Availability</Typography>
                    <Typography color={inStock ? "success.light" : "error.light"}>
                      {product.stock === null ? "Available" : product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                    </Typography>
                  </Stack>
                  {product.address && (
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Typography color="rgba(255,255,255,0.7)">Ships from</Typography>
                      <Typography textAlign="right">{product.address}</Typography>
                    </Stack>
                  )}
                  <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", my: 2 }} />
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      variant="outlined"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      disabled={!inStock || quantity <= 1}
                      sx={{ minWidth: 44, color: "white", borderColor: "rgba(255,255,255,0.3)" }}
                    >
                      −
                    </Button>
                    <Box sx={{ minWidth: 44, display: "grid", placeItems: "center" }}>{quantity}</Box>
                    <Button
                      variant="outlined"
                      onClick={() => setQuantity((value) => value + 1)}
                      disabled={!inStock}
                      sx={{ minWidth: 44, color: "white", borderColor: "rgba(255,255,255,0.3)" }}
                    >
                      +
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleAddToCart}
                      disabled={!inStock || adding}
                      sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                    >
                      {adding ? "Adding..." : inStock ? "Add to Cart" : "Out of Stock"}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {relatedProducts.length > 0 && (
          <Box sx={{ mt: 8 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
              More from {product.category}
            </Typography>
            <Grid container spacing={3}>
              {relatedProducts.map((related) => (
                <Grid item xs={12} sm={6} md={3} key={related.id}>
                  <Card component={Link} href={`/product/${related.slug}`} sx={{ height: "100%", bgcolor: "#0f172a", color: "white", borderRadius: 3, overflow: "hidden" }}>
                    <Box component="img" src={related.images[0]} alt={related.alt} sx={{ width: "100%", height: 180, objectFit: "cover" }} />
                    <CardContent>
                      <Typography sx={{ fontWeight: 700 }} noWrap>{related.title}</Typography>
                      <Typography color="primary.light" sx={{ mt: 1 }}>${related.price.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Container>
    </Box>
  );
}
