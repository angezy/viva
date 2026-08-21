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
import {
  AddRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
  FavoriteBorderRounded,
  FavoriteRounded,
  KeyboardArrowRightRounded,
  LocalShippingOutlined,
  LockOutlined,
  RemoveRounded,
  ReplayRounded,
  SecurityRounded,
  ShareRounded,
  ZoomInRounded,
} from "@mui/icons-material";
import { addToCart, fetchSavedProducts, removeSavedProduct, saveProduct } from "../../lib/apiClient";
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

function formatMoney(value, currency = "USD") {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch (_error) {
    return `$${amount.toFixed(2)}`;
  }
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
  const rawCompareAtPrice = product.compareAtPrice ?? product.CompareAtPrice ?? product.originalPrice ?? product.OriginalPrice;
  const rawStock = product.stock ?? product.Stock ?? product.quantity ?? product.Quantity;
  const numericPrice = Number(rawPrice);
  const numericCompareAtPrice = Number(rawCompareAtPrice);
  const numericStock = rawStock === undefined || rawStock === null || rawStock === "" ? null : Number(rawStock);
  const price = Number.isFinite(numericPrice) ? numericPrice : 0;

  return {
    id: product.id ?? product.PID ?? product.ProductId ?? product.productId ?? title,
    slug: getProductSlug(product),
    title,
    description: product.description || product.Description || "No description available.",
    category: product.category || product.Category || "Collection",
    brand: product.brand || product.Brand || "Weluxo",
    price,
    salePrice: Number.isFinite(Number(product.salePrice ?? product.SalePrice)) ? Number(product.salePrice ?? product.SalePrice) : price,
    compareAtPrice: Number.isFinite(numericCompareAtPrice) && numericCompareAtPrice > price ? numericCompareAtPrice : null,
    currency: product.currency || product.Currency || "USD",
    sku: product.sku || product.SKU || product.ProductCode || "",
    stock: Number.isFinite(numericStock) ? numericStock : null,
    isTrending: Boolean(product.isTrending ?? product.IsTrending ?? product.trending ?? product.Trending),
    alt: product.alt || product.Alt || title,
    address: product.address || product.Address || "",
    images: uniqueImages.length ? uniqueImages : [FALLBACK_IMAGE],
  };
}

function ProductLoading() {
  const skeletonColor = "rgba(43,43,43,0.08)";
  const panelSx = {
    bgcolor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 4,
  };

  return (
    <Box
      component="main"
      aria-busy="true"
      aria-label="Loading product details"
      sx={{ backgroundColor: "var(--color-background)", minHeight: "100vh", color: "var(--color-text-primary)", py: { xs: 3, md: 6 } }}
    >
      <Container maxWidth="lg">
        <Skeleton variant="text" width={220} height={30} sx={{ bgcolor: skeletonColor }} />
        <Grid container spacing={5} sx={{ mt: 1 }}>
          <Grid item xs={12} md={7}>
            <Box sx={panelSx}>
              <Skeleton
                variant="rounded"
                sx={{ height: { xs: 320, md: 520 }, bgcolor: skeletonColor, borderRadius: 4 }}
              />
            </Box>
            <Stack direction="row" spacing={1.5} sx={{ mt: 2, overflow: "hidden" }}>
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} variant="rounded" width={80} height={80} sx={{ flexShrink: 0, bgcolor: skeletonColor, borderRadius: 2 }} />
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1}>
                <Skeleton variant="rounded" width={92} height={28} sx={{ bgcolor: skeletonColor, borderRadius: 999 }} />
                <Skeleton variant="rounded" width={76} height={28} sx={{ bgcolor: skeletonColor, borderRadius: 999 }} />
              </Stack>
              <Box>
                <Skeleton variant="text" height={64} sx={{ bgcolor: skeletonColor }} />
                <Skeleton variant="text" width="68%" height={64} sx={{ bgcolor: skeletonColor }} />
              </Box>
              <Skeleton variant="text" width="34%" height={48} sx={{ bgcolor: skeletonColor }} />
              <Box>
                <Skeleton variant="text" height={24} sx={{ bgcolor: skeletonColor }} />
                <Skeleton variant="text" height={24} sx={{ bgcolor: skeletonColor }} />
                <Skeleton variant="text" width="82%" height={24} sx={{ bgcolor: skeletonColor }} />
              </Box>
              <Box sx={{ ...panelSx, p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between">
                    <Skeleton variant="text" width={105} sx={{ bgcolor: skeletonColor }} />
                    <Skeleton variant="text" width={85} sx={{ bgcolor: skeletonColor }} />
                  </Stack>
                  <Divider sx={{ borderColor: "var(--color-border)", my: 0.75 }} />
                  <Stack direction="row" spacing={1.5}>
                    <Skeleton variant="rounded" width={44} height={44} sx={{ bgcolor: skeletonColor, borderRadius: 2 }} />
                    <Skeleton variant="rounded" width={44} height={44} sx={{ bgcolor: skeletonColor, borderRadius: 2 }} />
                    <Skeleton variant="rounded" height={44} sx={{ flex: 1, bgcolor: skeletonColor, borderRadius: 999 }} />
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <Box sx={{ mt: { xs: 6, md: 8 } }}>
          <Skeleton variant="text" width={240} height={38} sx={{ bgcolor: skeletonColor }} />
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            {[0, 1, 2, 3].map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item}>
                <Box sx={{ ...panelSx, overflow: "hidden" }}>
                  <Skeleton variant="rectangular" height={180} sx={{ bgcolor: skeletonColor }} />
                  <Box sx={{ p: 2 }}>
                    <Skeleton variant="text" height={28} sx={{ bgcolor: skeletonColor }} />
                    <Skeleton variant="text" width="36%" sx={{ bgcolor: skeletonColor }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
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
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState("details");

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
    setSaved(false);
    setSaving(false);
    setActiveInfoTab("details");
  }, [product?.slug]);

  useEffect(() => {
    if (product) rememberProduct(product);
  }, [product]);

  useEffect(() => {
    if (!product?.id) return undefined;
    let active = true;
    fetchSavedProducts()
      .then((data) => {
        if (active) setSaved((data.items || []).some((item) => String(item.id) === String(product.id)));
      })
      .catch((error) => {
        if (error.message !== "unauthorized") console.error("Unable to load saved product state", error);
      });
    return () => {
      active = false;
    };
  }, [product?.id]);

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

  async function handleToggleSaved() {
    if (!product || saving) return;
    setSaving(true);
    try {
      if (saved) {
        await removeSavedProduct(product.id);
        setSaved(false);
        toast.success("Removed from saved products", { description: `${product.title} is no longer saved.` });
      } else {
        await saveProduct(product.id);
        setSaved(true);
        toast.success("Saved for later", {
          description: `${product.title} is available from your account dashboard.`,
          action: { label: "View saved", onClick: () => { window.location.href = "/account/saved"; } },
        });
      }
    } catch (error) {
      if (error.message === "unauthorized") {
        toast.info("Sign in to save products", {
          description: "Your saved products are kept with your customer account.",
          action: { label: "Sign in", onClick: () => { window.location.href = "/signin"; } },
        });
      } else {
        toast.error("Could not update saved products", { description: error.message || "Please try again." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    const shareData = { title: product?.title, text: product?.description, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard?.writeText(window.location.href);
      toast.success("Link copied", { description: "The product link is ready to share." });
    } catch (_error) {
      // Sharing can be cancelled by the user; there is nothing else to do.
    }
  }

  if (loading) return <ProductLoading />;
  if (!product) return <ProductNotFound error={loadError} />;

  const inStock = product.stock === null || product.stock > 0;
  const currentImage = product.images[selectedImage] || product.images[0];
  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price);
  const discountPercent = hasDiscount ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0;
  const stockLabel = product.stock === null ? "In stock" : product.stock > 0 ? `${product.stock} available` : "Out of stock";
  const infoTabs = [
    { id: "details", label: "Product details" },
    { id: "shipping", label: "Shipping & returns" },
    { id: "care", label: "Care guide" },
  ];

  return (
    <Box component="main" sx={{ backgroundColor: "var(--color-background)", minHeight: "100vh", color: "var(--color-text-primary)", py: { xs: 3, md: 5 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2.5, sm: 4, lg: 6 } }}>
        <Breadcrumbs
          separator={<KeyboardArrowRightRounded sx={{ fontSize: 18, color: "var(--color-text-secondary)" }} />}
          sx={{ mb: { xs: 3, md: 4 }, color: "var(--color-text-secondary)", fontSize: 13 }}
        >
          <Link href="/shop">Shop</Link>
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          <Typography sx={{ color: "var(--color-text-primary)", fontSize: "inherit", fontWeight: 700 }} noWrap>{product.title}</Typography>
        </Breadcrumbs>

        <Grid container spacing={{ xs: 4, md: 7 }} alignItems="flex-start">
          <Grid item xs={12} md={7}>
            <Box component="section" aria-label="Product gallery">
              <Card
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: { xs: 3, md: 4 },
                  bgcolor: "var(--color-surface-muted)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "0 22px 55px rgba(43,43,43,0.08)",
                }}
              >
                <Box
                  component="img"
                  src={currentImage}
                  alt={product.alt}
                  sx={{ display: "block", width: "100%", height: { xs: 390, sm: 500, md: 610 }, objectFit: "cover" }}
                />
                <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 18, left: 18 }}>
                  {product.isTrending && <Chip label="Trending" size="small" sx={{ bgcolor: "var(--color-accent)", color: "#fff", fontWeight: 850 }} />}
                  {hasDiscount && <Chip label={`${discountPercent}% off`} size="small" sx={{ bgcolor: "var(--color-primary)", color: "#fff", fontWeight: 850 }} />}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 14, right: 14 }}>
                  <Button
                    type="button"
                    onClick={handleToggleSaved}
                    disabled={saving}
                    aria-label={saved ? "Remove from saved products" : "Save product"}
                    aria-pressed={saved}
                    sx={{ minWidth: 42, width: 42, height: 42, p: 0, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.92)", color: saved ? "var(--color-error)" : "var(--color-text-primary)", boxShadow: "0 8px 18px rgba(43,43,43,0.12)", "&:hover": { bgcolor: "#fff" } }}
                  >
                    {saved ? <FavoriteRounded /> : <FavoriteBorderRounded />}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleShare}
                    aria-label="Share product"
                    sx={{ minWidth: 42, width: 42, height: 42, p: 0, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.92)", color: "var(--color-text-primary)", boxShadow: "0 8px 18px rgba(43,43,43,0.12)", "&:hover": { bgcolor: "#fff" } }}
                  >
                    <ShareRounded />
                  </Button>
                </Stack>
                <Button
                  component="a"
                  href={currentImage}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View full-size product image"
                  sx={{ position: "absolute", right: 18, bottom: 18, minWidth: 42, width: 42, height: 42, p: 0, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.92)", color: "var(--color-text-primary)", boxShadow: "0 8px 18px rgba(43,43,43,0.12)", "&:hover": { bgcolor: "#fff" } }}
                >
                  <ZoomInRounded />
                </Button>
                <Box sx={{ position: "absolute", left: 18, bottom: 18, px: 1.25, py: 0.65, borderRadius: 999, bgcolor: "rgba(43,43,43,0.72)", color: "#fff", fontSize: 12, fontWeight: 800 }}>
                  {selectedImage + 1} / {product.images.length}
                </Box>
              </Card>

              <Stack direction="row" spacing={1.5} sx={{ mt: 2, overflowX: "auto", pb: 1, scrollbarWidth: "thin" }}>
                {product.images.map((image, index) => (
                  <Box
                    component="button"
                    type="button"
                    key={`${image}-${index}`}
                    onClick={() => setSelectedImage(index)}
                    aria-label={`View product image ${index + 1}`}
                    aria-pressed={index === selectedImage}
                    sx={{
                      position: "relative",
                      border: index === selectedImage ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                      borderRadius: 2.5,
                      p: 0,
                      width: 86,
                      height: 86,
                      overflow: "hidden",
                      cursor: "pointer",
                      flexShrink: 0,
                      bgcolor: "var(--color-surface)",
                      opacity: index === selectedImage ? 1 : 0.72,
                      transition: "opacity 160ms ease, border-color 160ms ease, transform 160ms ease",
                      "&:hover": { opacity: 1, transform: "translateY(-2px)" },
                    }}
                  >
                    <Box component="img" src={image} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box component="section" aria-labelledby="product-title" sx={{ position: { md: "sticky" }, top: { md: 116 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  <Typography sx={{ color: "var(--color-primary)", fontSize: 12, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    {product.brand || "Weluxo"}
                  </Typography>
                  {product.sku && <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 11, letterSpacing: "0.04em" }}>SKU {product.sku}</Typography>}
                </Stack>
                <Typography id="product-title" component="h1" sx={{ maxWidth: 650, fontSize: { xs: "2.45rem", md: "3.65rem" }, fontWeight: 950, letterSpacing: "-0.055em", lineHeight: 0.98 }}>
                  {product.title}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Chip label={product.category} size="small" sx={{ bgcolor: "var(--color-accent-soft)", color: "var(--color-accent-dark)", fontWeight: 850 }} />
                  <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
                    <CheckCircleRounded sx={{ fontSize: 17, color: "var(--color-success)" }} />
                    <Typography component="span" sx={{ fontSize: "inherit" }}>Quality checked</Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Typography sx={{ color: "var(--color-primary)", fontSize: { xs: 31, md: 36 }, fontWeight: 950, letterSpacing: "-0.04em" }}>
                    {formatMoney(product.price, product.currency)}
                  </Typography>
                  {hasDiscount && <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 18, textDecoration: "line-through" }}>{formatMoney(product.compareAtPrice, product.currency)}</Typography>}
                  {hasDiscount && <Typography sx={{ color: "var(--color-accent-dark)", fontSize: 13, fontWeight: 850 }}>Save {formatMoney(product.compareAtPrice - product.price, product.currency)}</Typography>}
                </Stack>
                <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, fontSize: 15 }}>
                  {product.description}
                </Typography>

                <Card sx={{ bgcolor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 3.5, boxShadow: "0 16px 42px rgba(43,43,43,0.07)" }}>
                  <CardContent sx={{ p: { xs: 2.25, md: 2.75 }, "&:last-child": { pb: { xs: 2.25, md: 2.75 } } }}>
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: inStock ? "var(--color-success)" : "var(--color-error)", boxShadow: inStock ? "0 0 0 5px rgba(46,139,87,0.12)" : "0 0 0 5px rgba(201,74,74,0.12)" }} />
                          <Typography sx={{ fontWeight: 850 }}>{stockLabel}</Typography>
                        </Stack>
                        {product.stock !== null && product.stock > 0 && product.stock <= 5 && <Typography sx={{ color: "var(--color-accent-dark)", fontSize: 12, fontWeight: 850 }}>Low stock</Typography>}
                      </Stack>
                      {product.address && (
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <LocalShippingOutlined sx={{ mt: 0.15, color: "var(--color-primary)", fontSize: 19 }} />
                          <Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Ships from {product.address}</Typography>
                            <Typography sx={{ mt: 0.25, color: "var(--color-text-secondary)", fontSize: 12 }}>Delivery options are shown at checkout.</Typography>
                          </Box>
                        </Stack>
                      )}
                      <Divider sx={{ borderColor: "var(--color-border)" }} />
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 48, px: 0.5, border: "1px solid var(--color-border)", borderRadius: 999, bgcolor: "var(--color-surface-muted)" }}>
                          <Button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={!inStock || quantity <= 1} aria-label="Decrease quantity" sx={{ minWidth: 40, width: 40, height: 40, p: 0, color: "var(--color-text-primary)" }}><RemoveRounded fontSize="small" /></Button>
                          <Typography sx={{ minWidth: 28, textAlign: "center", fontSize: 14, fontWeight: 850 }}>{quantity}</Typography>
                          <Button type="button" onClick={() => setQuantity((value) => value + 1)} disabled={!inStock} aria-label="Increase quantity" sx={{ minWidth: 40, width: 40, height: 40, p: 0, color: "var(--color-text-primary)" }}><AddRounded fontSize="small" /></Button>
                        </Stack>
                        <Button fullWidth variant="contained" onClick={handleAddToCart} disabled={!inStock || adding} sx={{ minHeight: 48, px: 3, fontSize: 15, borderRadius: 999 }}>
                          {adding ? "Adding to cart..." : inStock ? "Add to cart" : "Out of stock"}
                        </Button>
                      </Stack>
                      <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 11.5, textAlign: "center" }}>Taxes and shipping calculated at checkout.</Typography>
                    </Stack>
                  </CardContent>
                </Card>

                <Grid container spacing={1.25}>
                  {[
                    { icon: <SecurityRounded />, title: "Secure payment", copy: "Protected checkout" },
                    { icon: <ReplayRounded />, title: "Easy support", copy: "Here when you need us" },
                    { icon: <LockOutlined />, title: "Order protection", copy: "Carefully packed" },
                  ].map((item) => (
                    <Grid item xs={4} key={item.title}>
                      <Stack alignItems="center" spacing={0.7} sx={{ height: "100%", px: { xs: 0.25, sm: 1 }, py: 1.25, textAlign: "center", border: "1px solid var(--color-border)", borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.34)" }}>
                        <Box sx={{ color: "var(--color-primary)", lineHeight: 1 }}>{item.icon}</Box>
                        <Typography sx={{ fontSize: { xs: 10, sm: 11 }, fontWeight: 850, lineHeight: 1.2 }}>{item.title}</Typography>
                        <Typography sx={{ display: { xs: "none", sm: "block" }, color: "var(--color-text-secondary)", fontSize: 10.5, lineHeight: 1.2 }}>{item.copy}</Typography>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </Box>
          </Grid>
        </Grid>

        <Box component="section" aria-label="Product information" sx={{ mt: { xs: 7, md: 10 }, p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 3, md: 4 }, bgcolor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 0.5, md: 1 }} sx={{ mb: 3, borderBottom: "1px solid var(--color-border)" }}>
            {infoTabs.map((tab) => (
              <Button key={tab.id} type="button" onClick={() => setActiveInfoTab(tab.id)} sx={{ justifyContent: "flex-start", minHeight: 46, px: { xs: 1, md: 1.5 }, borderRadius: 0, color: activeInfoTab === tab.id ? "var(--color-primary)" : "var(--color-text-secondary)", borderBottom: activeInfoTab === tab.id ? "2px solid var(--color-primary)" : "2px solid transparent", fontWeight: 850, "&:hover": { bgcolor: "var(--color-primary-soft)" } }}>
                {tab.label}
              </Button>
            ))}
          </Stack>
          {activeInfoTab === "details" && (
            <Grid container spacing={{ xs: 3, md: 6 }}>
              <Grid item xs={12} md={7}>
                <Typography component="h2" sx={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em", mb: 1.25 }}>Made for your everyday</Typography>
                <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.85, whiteSpace: "pre-line" }}>{product.description}</Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={1.25}>
                  {[
                    ["Category", product.category],
                    ["Brand", product.brand],
                    ...(product.sku ? [["SKU", product.sku]] : []),
                  ].map(([label, value]) => (
                    <Stack key={label} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1.25, borderBottom: "1px solid var(--color-border)" }}>
                      <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{label}</Typography>
                      <Typography sx={{ maxWidth: "62%", textAlign: "right", fontSize: 13, fontWeight: 800 }}>{value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          )}
          {activeInfoTab === "shipping" && (
            <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
              <Typography component="h2" sx={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em" }}>Shipping made simple</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.85 }}>Your available delivery options and estimated arrival date are shown during checkout based on your destination.</Typography>
              <Stack direction="row" spacing={1.25} alignItems="flex-start"><LocalShippingOutlined sx={{ color: "var(--color-primary)", mt: 0.25 }} /><Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>Track your order from confirmation through delivery.</Typography></Stack>
              <Button component={Link} href="/shipping-information" endIcon={<ArrowForwardRounded />} sx={{ alignSelf: "flex-start", px: 0, color: "var(--color-primary)" }}>Read shipping information</Button>
            </Stack>
          )}
          {activeInfoTab === "care" && (
            <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
              <Typography component="h2" sx={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.02em" }}>Keep it in great shape</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.85 }}>Follow the care instructions supplied with your product and store it in a clean, dry place between uses. If you need help, our support team is ready to assist.</Typography>
              <Button component={Link} href="/contact" endIcon={<ArrowForwardRounded />} sx={{ alignSelf: "flex-start", px: 0, color: "var(--color-primary)" }}>Contact support</Button>
            </Stack>
          )}
        </Box>

        {relatedProducts.length > 0 && (
          <Box component="section" aria-labelledby="related-products-title" sx={{ mt: { xs: 7, md: 10 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} spacing={1} sx={{ mb: 3 }}>
              <Box>
                <Typography sx={{ color: "var(--color-accent-dark)", fontSize: 12, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" }}>You may also like</Typography>
                <Typography id="related-products-title" component="h2" sx={{ mt: 0.5, fontSize: { xs: 28, md: 34 }, fontWeight: 950, letterSpacing: "-0.045em" }}>More from {product.category}</Typography>
              </Box>
              <Button component={Link} href={`/shop?category=${encodeURIComponent(product.category)}`} endIcon={<ArrowForwardRounded />} sx={{ alignSelf: { xs: "flex-start", sm: "auto" }, color: "var(--color-primary)" }}>View collection</Button>
            </Stack>
            <Grid container spacing={2.5}>
              {relatedProducts.map((related) => (
                <Grid item xs={12} sm={6} md={3} key={related.id}>
                  <Card component={Link} href={`/product/${related.slug}`} sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 3.5, overflow: "hidden", transition: "transform 180ms ease, box-shadow 180ms ease", "&:hover": { transform: "translateY(-5px)", boxShadow: "0 20px 38px rgba(43,43,43,0.12)" } }}>
                    <Box sx={{ position: "relative", bgcolor: "var(--color-surface-muted)" }}>
                      <Box component="img" src={related.images[0]} alt={related.alt} sx={{ display: "block", width: "100%", height: 220, objectFit: "cover" }} />
                      <Box sx={{ position: "absolute", right: 12, bottom: 12, width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.92)", color: "var(--color-primary)" }}><ArrowForwardRounded sx={{ fontSize: 18 }} /></Box>
                    </Box>
                    <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", p: 2.25 }}>
                      <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>{related.brand}</Typography>
                      <Typography sx={{ mt: 0.75, fontWeight: 850, lineHeight: 1.3 }}>{related.title}</Typography>
                      <Typography sx={{ mt: "auto", pt: 2, color: "var(--color-primary)", fontSize: 17, fontWeight: 900 }}>{formatMoney(related.price, related.currency)}</Typography>
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
