"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Box, Card, CardContent, CardMedia, Chip, Stack, Typography } from "@mui/material";
import { getRecentlyViewed } from "../lib/recentProducts";

function imageFor(product = {}) {
  const candidate = product.image || product.img || product.Img || product.IMG || product.imageUrl || (Array.isArray(product.images) ? product.images[0] : "");
  if (!candidate) return "https://placehold.co/600x500?text=Weluxo";
  if (typeof candidate === "object") return candidate.url || candidate.src || candidate.imageUrl || "https://placehold.co/600x500?text=Weluxo";
  return String(candidate);
}

function titleFor(product = {}) {
  return product.title || product.name || product.Name || "Untitled product";
}

function priceFor(value) {
  return value > 0 ? `$${value.toFixed(2)}` : "View product";
}

function ProductTile({ product, label }) {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  return (
    <Card component={Link} href={href} className="resume-product-card" sx={{ display: "block", minWidth: { xs: 190, sm: 220 }, maxWidth: 250, flex: "1 0 0", borderRadius: 2.5, overflow: "hidden", textDecoration: "none", color: "inherit", bgcolor: "#fff", border: "1px solid #e6e9ef", boxShadow: "0 5px 18px rgba(15,23,42,0.08)", transition: "transform .18s ease, box-shadow .18s ease", "&:hover": { transform: "translateY(-3px)", boxShadow: "0 12px 28px rgba(15,23,42,0.14)" } }}>
      <Box sx={{ position: "relative" }}>
        <CardMedia component="img" image={product.image} alt={titleFor(product)} sx={{ height: { xs: 170, sm: 190 }, objectFit: "contain", bgcolor: "#fff", p: 1.5 }} />
        {label && <Chip label={label} size="small" sx={{ position: "absolute", top: 10, left: 10, height: 22, fontSize: 10, fontWeight: 800, bgcolor: "#111827", color: "#fff" }} />}
      </Box>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography sx={{ color: "#111827", fontSize: 14, fontWeight: 800, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{titleFor(product)}</Typography>
        <Typography sx={{ mt: 0.7, color: "#526074", fontSize: 13 }}>{priceFor(Number(product.price) || 0)}</Typography>
      </CardContent>
    </Card>
  );
}

export default function ResumeShoppingSection({ products = [] }) {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const readHistory = () => setRecent(getRecentlyViewed());
    readHistory();
    window.addEventListener("weluxo:recent-products-updated", readHistory);
    window.addEventListener("storage", readHistory);
    return () => {
      window.removeEventListener("weluxo:recent-products-updated", readHistory);
      window.removeEventListener("storage", readHistory);
    };
  }, []);

  const recentProducts = useMemo(() => {
    return recent.filter((item) => item.slug);
  }, [recent]);

  if (!products.length || !recentProducts.length) return null;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 4 }, py: 4, color: "#111827" }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Pick Up Where You Left Off</Typography>
        <Typography sx={{ color: "#526074", mt: 0.4, fontSize: 14 }}>
          Continue exploring products you viewed recently.
        </Typography>
        <Typography sx={{ mt: 0.4, color: "#526074", fontSize: 14 }}>
          <Link href="/signin" style={{ color: "#2563eb" }}>Sign in</Link> to see more personalized suggestions for you.
        </Typography>
      </Box>

      {recentProducts.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ overflowX: "auto", pb: 1, mb: 4 }}>
          {recentProducts.slice(0, 4).map((product) => <ProductTile key={`recent-${product.key || product.slug}`} product={product} label="Recently viewed" />)}
        </Stack>
      )}

    </Box>
  );
}
