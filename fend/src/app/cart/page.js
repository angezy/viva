"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Country } from "country-state-city";
import {
  Add,
  CheckCircleOutline,
  CreditCard,
  DeleteOutline,
  FavoriteBorder,
  LocalShippingOutlined,
  LockOutlined,
  Remove,
  ReplayOutlined,
  ShoppingCartOutlined,
  SupportAgentOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  addToCart,
  applyCartCoupon,
  estimateCartShipping,
  fetchCart,
  fetchSession,
  removeCartItem,
  saveCartItem,
  updateCartItem,
} from "../lib/apiClient";
import { readCheckoutState, updateCheckoutState } from "../checkout/components/checkoutState";

const FREE_SHIPPING_THRESHOLD = 100;
const FALLBACK_IMAGE = "https://placehold.co/240x240?text=Weluxo";

const initialEstimates = [
  { method: "standard", label: "Standard Shipping", window: "7-15 business days", cost: 0, free: true },
  { method: "express", label: "Express Shipping", window: "3-7 business days", cost: 19.99, free: false },
];

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function itemPrice(item) {
  return Number(item?.price) || 0;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function subtotalFor(items) {
  return items.reduce((sum, item) => sum + itemPrice(item) * (Number(item.quantity) || 0), 0);
}

function productDetails(product = {}) {
  const title = product.name || product.Name || product.title || "Weluxo product";
  const rawPrice = Number(product.price ?? product.Price ?? 0);
  const explicitSlug = product.slug || product.Slug || product.handle || product.Handle;
  return {
    id: product.id ?? product.PID ?? product.ProductId ?? product.productId,
    slug: String(explicitSlug || slugify(title)).replace(/^\/product\//, "").replace(/^\//, "").replace(/\/$/, ""),
    title,
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    image: product.img || product.Img || product.IMG || product.image || product.imageUrl || FALLBACK_IMAGE,
  };
}

function RecommendedProductCard({ product, details, onAdd }) {
  return (
    <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 3, overflow: "hidden", transition: "transform 180ms ease, box-shadow 180ms ease", "&:hover": { transform: "translateY(-3px)", boxShadow: "0 14px 30px rgba(43,43,43,0.1)" } }}>
      <Box component={Link} href={`/product/${encodeURIComponent(details.slug)}`} sx={{ display: "block", color: "inherit", textDecoration: "none", "&:focus-visible": { outline: "3px solid var(--color-primary-light)", outlineOffset: -3 } }} aria-label={`View ${details.title}`}>
        <CardMedia component="img" image={details.image} alt={details.title} sx={{ height: 180, objectFit: "cover" }} />
        <CardContent sx={{ pb: 1.25 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap>{details.title}</Typography>
          <Typography color="primary.main" sx={{ mt: 0.75, fontWeight: 800 }}>{money(details.price)}</Typography>
        </CardContent>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        <Button fullWidth size="small" variant="contained" onClick={() => onAdd(product)} sx={{ borderRadius: 999 }}>
          Add to cart
        </Button>
      </Box>
    </Card>
  );
}

function CartItem({ item, pending, onQuantity, onRemove, onSave }) {
  const price = itemPrice(item);
  const originalPrice = Number(item.originalPrice) || 0;
  const quantity = Number(item.quantity) || 1;
  const stock = Number(item.stock);
  const maxQuantity = stock > 0 ? stock : 99;
  const inStock = stock <= 0 || Number.isNaN(stock) ? true : stock >= quantity;

  return (
    <Card
      sx={{
        width: "100%",
        minWidth: 0,
        bgcolor: "#ffffff",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border)",
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "90px minmax(0, 1fr)", sm: "120px minmax(0, 1fr)" }, gap: { xs: 1.5, sm: 2.5 }, alignItems: "start" }}>
          <CardMedia
            component="img"
            image={item.image || FALLBACK_IMAGE}
            alt={item.title || "Product"}
            sx={{ width: { xs: 90, sm: 120 }, height: { xs: 90, sm: 120 }, borderRadius: 2, objectFit: "cover", bgcolor: "var(--color-surface-muted)" }}
          />

          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="start" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.15rem" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title || "Product"}
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--color-primary)", mt: 0.25 }}>
                  {item.brand || "Weluxo"} · {item.category || "Collection"}
                </Typography>
              </Box>
              <IconButton aria-label={`Remove ${item.title || "item"}`} onClick={() => onRemove(item.productId)} disabled={pending} sx={{ color: "var(--color-text-secondary)", p: 0.5 }}>
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }} sx={{ mt: 0.75, color: "#7a7d82" }}>
              <Typography variant="caption">SKU: {item.sku || `WLX-${item.productId}`}</Typography>
              <Typography variant="caption">Variant: Standard</Typography>
            </Stack>

            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
              <CheckCircleOutline sx={{ fontSize: 16, color: inStock ? "#34d399" : "#f87171" }} />
              <Typography variant="body2" sx={{ color: inStock ? "#86efac" : "#fca5a5" }}>{inStock ? "In stock" : "Out of stock"}</Typography>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5} sx={{ mt: 1.5 }}>
              <Box>
                {originalPrice > price && <Typography component="span" variant="body2" sx={{ mr: 1, color: "#7a7d82", textDecoration: "line-through" }}>{money(originalPrice)}</Typography>}
                <Typography component="span" sx={{ color: "var(--color-text-primary)", fontWeight: 900, fontSize: "1.1rem" }}>{money(price)}</Typography>
              </Box>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>Quantity</Typography>
                <Stack direction="row" alignItems="center" sx={{ border: "1px solid var(--color-border)", borderRadius: 2 }}>
                  <IconButton aria-label="Decrease quantity" size="small" onClick={() => onQuantity(item, -1)} disabled={pending || quantity <= 1} sx={{ color: "var(--color-text-primary)" }}><Remove fontSize="small" /></IconButton>
                  <Typography sx={{ minWidth: 28, textAlign: "center", fontWeight: 800 }}>{quantity}</Typography>
                  <IconButton aria-label="Increase quantity" size="small" onClick={() => onQuantity(item, 1)} disabled={pending || quantity >= maxQuantity} sx={{ color: "var(--color-text-primary)" }}><Add fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
              <Button size="small" startIcon={<FavoriteBorder />} onClick={() => onSave(item)} disabled={pending} sx={{ color: "var(--color-primary)", px: 0, textTransform: "none" }}>Save for later</Button>
              <Button size="small" startIcon={<DeleteOutline />} onClick={() => onRemove(item.productId)} disabled={pending} sx={{ color: "var(--color-text-secondary)", px: 0, textTransform: "none" }}>Remove</Button>
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function TrustSection() {
  const trustItems = [
    { icon: <LockOutlined />, title: "Secure Payment", text: "Your information is protected" },
    { icon: <CreditCard />, title: "Payment Methods", text: "Visa · Mastercard · PayPal" },
    { icon: <LocalShippingOutlined />, title: "Shipping Guarantee", text: "Worldwide delivery tracking" },
    { icon: <ReplayOutlined />, title: "Easy Returns", text: "30-day return policy" },
  ];

  return (
    <Box sx={{ mt: 2.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
      {trustItems.map((item) => (
        <Stack key={item.title} direction="row" spacing={1.25} alignItems="flex-start" sx={{ p: 1.5, borderRadius: 2, bgcolor: "var(--color-surface-muted)" }}>
          <Box sx={{ color: "var(--color-accent)", display: "grid", placeItems: "center" }}>{item.icon}</Box>
          <Box sx={{ minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 800 }}>{item.title}</Typography><Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>{item.text}</Typography></Box>
        </Stack>
      ))}
    </Box>
  );
}

export default function CartPage() {
  const [user, setUser] = useState({ id: "guest", guest: true });
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const couponRef = useRef({ code: "", discountPercent: 0, expiresAt: null });
  const [discount, setDiscount] = useState(0);
  const [shippingCountry, setShippingCountry] = useState("US");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState(() => readCheckoutState().shipping.method || "standard");
  const [shippingEstimates, setShippingEstimates] = useState(initialEstimates);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [exitOpen, setExitOpen] = useState(false);

  const countryOptions = useMemo(
    () => Country.getAllCountries().map((country) => ({ code: country.isoCode, label: country.name })).sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const selectedShipping = shippingEstimates.find((estimate) => estimate.method === shippingMethod) || initialEstimates[0];
  const shippingCost = Number(selectedShipping.cost) || 0;
  const total = Math.max(0, subtotal + shippingCost - discount);
  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const syncCart = useCallback((data) => {
    const nextItems = Array.isArray(data?.items) ? data.items : [];
    const nextSubtotal = Number(data?.subtotal);
    const resolvedSubtotal = Number.isFinite(nextSubtotal) ? nextSubtotal : subtotalFor(nextItems);
    setItems(nextItems);
    setSubtotal(resolvedSubtotal);
    if (Object.prototype.hasOwnProperty.call(data || {}, "coupon")) {
      const nextCoupon = data.coupon ? {
        code: data.coupon.code || "",
        discountPercent: Number(data.coupon.discountPercent) || 0,
        expiresAt: data.coupon.expiresAt || null,
      } : { code: "", discountPercent: 0, expiresAt: null };
      couponRef.current = nextCoupon;
      setAppliedCoupon(nextCoupon.code);
      setDiscount(Number(data.discount) || 0);
    } else {
      const currentCoupon = couponRef.current;
      setDiscount(currentCoupon.code ? Number((resolvedSubtotal * currentCoupon.discountPercent / 100).toFixed(2)) : 0);
    }
  }, []);

  const loadCart = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const session = await fetchSession();
      setUser(session?.user || { id: "guest", guest: true });
      const cart = await fetchCart();
      syncCart(cart);
    } catch (err) {
      setError(err.message || "Unable to load cart");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [syncCart]);

  useEffect(() => {
    loadCart();
    fetch("/api/shop", { cache: "no-store" }).then((res) => res.json()).then((data) => setRecommended(Array.isArray(data) ? data.slice(0, 4) : [])).catch(() => {});
  }, [loadCart]);

  useEffect(() => {
    const handleCartUpdate = (event) => syncCart(event.detail || {});
    window.addEventListener("weluxo:cart-updated", handleCartUpdate);
    return () => window.removeEventListener("weluxo:cart-updated", handleCartUpdate);
  }, [syncCart]);

  useEffect(() => {
    const handleExitIntent = (event) => {
      if (event.clientY > 0 || !items.length || window.sessionStorage.getItem("weluxo_exit_offer_seen")) return;
      window.sessionStorage.setItem("weluxo_exit_offer_seen", "1");
      setExitOpen(true);
    };
    document.addEventListener("mouseleave", handleExitIntent);
    return () => document.removeEventListener("mouseleave", handleExitIntent);
  }, [items.length]);

  async function handleQuantity(item, delta) {
    const currentQuantity = Number(item.quantity) || 1;
    const maxQuantity = Number(item.stock) > 0 ? Number(item.stock) : 99;
    const nextQuantity = Math.min(maxQuantity, Math.max(1, currentQuantity + delta));
    if (nextQuantity === currentQuantity) return;
    setPendingId(item.productId);
    setItems((current) => current.map((entry) => String(entry.productId) === String(item.productId) ? { ...entry, quantity: nextQuantity } : entry));
    setSubtotal((current) => current + itemPrice(item) * (nextQuantity - currentQuantity));
    try {
      const result = await updateCartItem(item.productId, nextQuantity);
      syncCart(result);
    } catch (err) {
      setError(err.message || "Unable to update quantity");
      await loadCart(false);
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(productId) {
    const previous = items;
    setPendingId(productId);
    setItems((current) => current.filter((item) => String(item.productId) !== String(productId)));
    setSubtotal((current) => subtotalFor(previous.filter((item) => String(item.productId) !== String(productId))));
    try {
      const result = await removeCartItem(productId);
      syncCart(result);
    } catch (err) {
      setError(err.message || "Unable to remove item");
      await loadCart(false);
    } finally {
      setPendingId(null);
    }
  }

  async function handleSave(item) {
    setPendingId(item.productId);
    try {
      const result = await saveCartItem(item);
      syncCart(result);
      setNotice(`${item.title || "Item"} was saved for later.`);
    } catch (err) {
      setError(err.message || "Unable to save item");
    } finally {
      setPendingId(null);
    }
  }

  async function handleApplyCoupon(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await applyCartCoupon(couponCode);
      const nextCode = result.code || couponCode.trim().toUpperCase();
      const nextCoupon = { code: nextCode, discountPercent: Number(result.discountPercent) || 0, expiresAt: result.expiresAt || null };
      couponRef.current = nextCoupon;
      setAppliedCoupon(nextCode);
      setDiscount(Number(result.discount) || 0);
      updateCheckoutState({ coupon: { ...nextCoupon, discount: Number(result.discount) || 0 } });
      setNotice(`${result.code || couponCode.toUpperCase()} applied. You saved ${money(result.discount)}.`);
    } catch (err) {
      setError(err.message || "Unable to apply coupon");
    }
  }

  async function handleEstimateShipping(event) {
    event.preventDefault();
    setShippingLoading(true);
    setError("");
    try {
      const result = await estimateCartShipping({ country: shippingCountry, postalCode: shippingPostalCode, method: shippingMethod });
      setShippingEstimates(result.estimates || initialEstimates);
      setNotice("Shipping estimates updated.");
    } catch (err) {
      setError(err.message || "Unable to estimate shipping");
    } finally {
      setShippingLoading(false);
    }
  }

  function chooseShippingMethod(method) {
    setShippingMethod(method);
    const checkoutState = readCheckoutState();
    updateCheckoutState({ shipping: { ...checkoutState.shipping, method } });
  }

  async function handleRecommendedAdd(product) {
    const details = productDetails(product);
    try {
      const result = await addToCart({ productId: details.id, title: details.title, price: details.price, image: details.image, quantity: 1 });
      syncCart(result);
      setNotice(`${details.title} added to your cart.`);
    } catch (err) {
      setError(err.message || "Unable to add item");
    }
  }

  const summary = (
    <Card sx={{ width: "100%", minWidth: 0, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 3, position: { md: "sticky" }, top: { md: 24 } }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>Order summary</Typography>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.25 }}><Typography color="var(--color-text-secondary)">Subtotal</Typography><Typography>{money(subtotal)}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.25 }}><Typography color="var(--color-text-secondary)">Shipping</Typography><Typography color={shippingCost ? "var(--color-text-primary)" : "#15803d"}>{shippingCost ? money(shippingCost) : "Free"}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.25 }}><Typography color="var(--color-text-secondary)">Tax</Typography><Typography color="var(--color-text-secondary)">Calculated at checkout</Typography></Stack>
        {discount > 0 && <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.25 }}><Typography color="var(--color-text-secondary)">Discount {appliedCoupon && `(${appliedCoupon})`}</Typography><Typography color="#15803d">-{money(discount)}</Typography></Stack>}
        <Divider sx={{ borderColor: "var(--color-border)", my: 2 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2.5 }}><Typography variant="h6" sx={{ fontWeight: 900 }}>Total</Typography><Typography variant="h5" sx={{ fontWeight: 900 }}>{money(total)}</Typography></Stack>
        <Button component={Link} href={items.length ? "/checkout" : undefined} disabled={!items.length || loading} fullWidth variant="contained" size="large" sx={{ borderRadius: 999, py: 1.5, fontWeight: 900 }}>{loading ? "Loading cart..." : "Proceed to checkout"}</Button>
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5, color: "var(--color-text-secondary)" }}><LockOutlined sx={{ fontSize: 17 }} /><Typography variant="caption">Secure checkout</Typography></Stack>
        <TrustSection />
      </CardContent>
    </Card>
  );

  if (loading) {
    return <Box sx={{ backgroundColor: "var(--color-background)", minHeight: "100vh", py: 6 }}><Container maxWidth="lg"><Skeleton variant="text" width={260} height={60} /><Skeleton variant="rounded" height={180} sx={{ mt: 2 }} /></Container></Box>;
  }

  return (
    <Box sx={{ backgroundColor: "var(--color-background)", minHeight: "100vh", color: "var(--color-text-primary)", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2} sx={{ mb: 3 }}>
          <Box>
            <Link href="/" style={{ color: "var(--color-text-primary)", textDecoration: "none" }}><Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: "-0.04em" }}>Weluxo</Typography></Link>
            <Typography variant="body2" sx={{ mt: 0.75, color: "var(--color-text-secondary)" }}>Secure shopping cart</Typography>
          </Box>
          <Button component={Link} href="/shop" variant="outlined" sx={{ alignSelf: { xs: "stretch", sm: "auto" }, color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999 }}>Continue shopping</Button>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1.5, mb: 4 }}>
          {["Secure checkout", "Money-back guarantee", "Worldwide shipping", "Customer support"].map((label) => <Stack key={label} direction="row" spacing={0.75} alignItems="center" sx={{ color: "var(--color-text-secondary)" }}><CheckCircleOutline sx={{ fontSize: 17, color: "var(--color-accent)" }} /><Typography variant="caption">{label}</Typography></Stack>)}
        </Box>

        <Typography variant="h3" sx={{ fontWeight: 950, fontSize: { xs: "2rem", md: "3rem" }, mb: 3 }}>Your cart {items.length > 0 && <Typography component="span" sx={{ color: "var(--color-text-secondary)", fontSize: "0.48em", fontWeight: 700 }}>({items.length} {items.length === 1 ? "item" : "items"})</Typography>}</Typography>
        {(error || notice) && <Alert severity={error ? "error" : "success"} onClose={() => { setError(""); setNotice(""); }} sx={{ mb: 3 }}>{error || notice}</Alert>}

        {items.length === 0 ? (
          <Box>
            <Card sx={{ p: { xs: 4, md: 7 }, textAlign: "center", bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: 4 }}>
              <ShoppingCartOutlined sx={{ fontSize: 72, color: "primary.light", mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>Your cart is empty</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", maxWidth: 430, mx: "auto", mb: 3 }}>Looks like you haven’t added anything yet. Discover something made for your next goal.</Typography>
              <Button component={Link} href="/shop" variant="contained" size="large" sx={{ borderRadius: 999, px: 4 }}>Continue shopping</Button>
            </Card>
            {!!recommended.length && <Box sx={{ mt: 5 }}><Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>Recommended for you</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>{recommended.map((product) => { const details = productDetails(product); return <RecommendedProductCard key={details.id || details.title} product={product} details={details} onAdd={handleRecommendedAdd} />; })}</Box></Box>}
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 7fr) minmax(320px, 3fr)" }, gap: 3, alignItems: "start" }}>
            <Box sx={{ minWidth: 0 }}>
              {remainingForFreeShipping > 0 ? <Card sx={{ mb: 2, bgcolor: "rgba(37,99,235,0.13)", color: "white", border: "1px solid rgba(96,165,250,0.22)" }}><CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}><Stack direction="row" spacing={1} alignItems="center"><LocalShippingOutlined color="primary" /><Typography variant="body2">You are <strong>{money(remainingForFreeShipping)}</strong> away from free shipping.</Typography></Stack><LinearProgress variant="determinate" value={freeShippingProgress} sx={{ mt: 1.25, height: 7, borderRadius: 99 }} /></CardContent></Card> : <Alert severity="success" sx={{ mb: 2 }}>You unlocked free standard shipping.</Alert>}
              <Stack spacing={2}>{items.map((item) => <CartItem key={item.productId} item={item} pending={pendingId === item.productId} onQuantity={handleQuantity} onRemove={handleRemove} onSave={handleSave} />)}</Stack>

              <Card sx={{ mt: 2, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}><CardContent><Typography variant="h6" sx={{ fontWeight: 850, mb: 1 }}>Have a promo code?</Typography><Box component="form" onSubmit={handleApplyCoupon} sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}><TextField size="small" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Enter coupon code" sx={{ flex: "1 1 220px" }} /><Button type="submit" variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 2 }}>Apply</Button></Box>{appliedCoupon && <Typography variant="body2" sx={{ mt: 1.25, color: "#15803d" }}>{appliedCoupon} · {couponRef.current.discountPercent}% discount applied</Typography>}</CardContent></Card>

              <Card sx={{ mt: 2, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}><CardContent><Typography variant="h6" sx={{ fontWeight: 850, mb: 1 }}>Estimate shipping</Typography><Box component="form" onSubmit={handleEstimateShipping} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr auto" }, gap: 1.5, alignItems: "start" }}><TextField select size="small" label="Country" value={shippingCountry} onChange={(event) => setShippingCountry(event.target.value)} /><TextField size="small" label="ZIP / postal code" value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} /><Button type="submit" variant="contained" disabled={shippingLoading} sx={{ borderRadius: 2, minHeight: 40 }}>Calculate</Button></Box><Stack spacing={1} sx={{ mt: 2 }}>{shippingEstimates.map((estimate) => <Button key={estimate.method} onClick={() => chooseShippingMethod(estimate.method)} sx={{ justifyContent: "space-between", textAlign: "left", color: "var(--color-text-primary)", p: 1.5, borderRadius: 2, border: shippingMethod === estimate.method ? "1px solid var(--color-primary)" : "1px solid var(--color-border)", bgcolor: shippingMethod === estimate.method ? "var(--color-primary-soft)" : "transparent" }}><Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{estimate.label}</Typography><Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>{estimate.window}</Typography></Box><Typography>{estimate.cost ? money(estimate.cost) : "FREE"}</Typography></Button>)}</Stack></CardContent></Card>
            </Box>
            <Box sx={{ minWidth: 0 }}>{summary}</Box>
            {!!recommended.length && <Box sx={{ gridColumn: { md: "1 / -1" }, mt: 2 }}><Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>Frequently bought together</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>{recommended.map((product) => { const details = productDetails(product); return <RecommendedProductCard key={`frequent-${details.id || details.title}`} product={product} details={details} onAdd={handleRecommendedAdd} />; })}</Box></Box>}
          </Box>
        )}
      </Container>

      <Dialog open={exitOpen} onClose={() => setExitOpen(false)} PaperProps={{ sx: { borderRadius: 3, p: 1 } }}><DialogTitle sx={{ fontWeight: 900 }}>Wait! Get 10% off your order</DialogTitle><DialogContent><Typography color="text.secondary">Use code WELCOME10 before checkout and save on your Weluxo cart.</Typography></DialogContent><DialogActions><Button onClick={() => setExitOpen(false)}>Keep browsing</Button><Button variant="contained" onClick={async () => { try { const result = await applyCartCoupon("WELCOME10"); const nextCoupon = { code: result.code || "WELCOME10", discountPercent: Number(result.discountPercent) || 0, expiresAt: result.expiresAt || null }; couponRef.current = nextCoupon; setCouponCode("WELCOME10"); setAppliedCoupon(nextCoupon.code); setDiscount(Number(result.discount) || 0); updateCheckoutState({ coupon: { ...nextCoupon, discount: Number(result.discount) || 0 } }); setNotice("WELCOME10 applied. Your discount is ready."); } catch (err) { setError(err.message || "Unable to apply discount"); } setExitOpen(false); }}>Apply discount</Button></DialogActions></Dialog>
    </Box>
  );
}
