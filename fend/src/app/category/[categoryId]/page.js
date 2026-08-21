import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Breadcrumbs,
  Card,
  Container,
  Button,
  Typography,
} from "@mui/material";
import CategoryProductGrid from "./CategoryProductGrid";
import { getSiteSettingsServer, siteUrlFor } from "../../lib/siteSettingsServer";

export const dynamic = "force-dynamic";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayName(value) {
  return decodeURIComponent(String(value || ""))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function getProductSlug(product) {
  return slugify(product.slug || product.Slug || product.name || product.Name || product.title);
}

function getImage(product) {
  const galleryImage = Array.isArray(product.images) ? product.images.find((image) => typeof image === "string" && image.trim()) : "";
  return galleryImage || product.img || product.Img || product.IMG || product.image || product.imageUrl || FALLBACK_IMAGE;
}

function normalizeProduct(product = {}) {
  const category = product.category || product.Category || "Collection";
  const title = product.name || product.Name || product.title || "Untitled product";
  const price = Number(product.price ?? product.Price ?? 0);

  return {
    id: product.id ?? product.PID ?? product.ProductId ?? product.productId ?? title,
    slug: getProductSlug(product),
    title,
    category,
    brand: product.brand || product.Brand || "Weluxo",
    description: product.description || product.Description || "No description available.",
    image: getImage(product),
    price: Number.isFinite(price) ? price : 0,
    alt: product.alt || product.Alt || title,
  };
}

async function getCatalog() {
  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!backendUrl) throw new Error("Backend is not configured.");

  const response = await fetch(`${backendUrl}/api/shop`, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Unable to load products.");
  return Array.isArray(data) ? data.map(normalizeProduct) : [];
}

export async function generateMetadata({ params }) {
  const { categoryId } = await params;
  const category = displayName(categoryId);
  const slug = slugify(categoryId);
  const site = await getSiteSettingsServer();
  const url = siteUrlFor(site, `/category/${slug}`);

  return {
    title: `${category} | ${site.siteName} Shop`,
    description: `Explore the ${category} collection at ${site.siteName}. Browse products, compare details, and find your next favorite.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${category} | ${site.siteName} Shop`,
      description: `Shop the ${category} collection at ${site.siteName}.`,
      url,
      siteName: site.siteName,
      type: "website",
    },
  };
}

function CategoryError() {
  return (
    <Container sx={{ py: 8 }}>
      <Card sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Category unavailable
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          We could not load this category right now. Please try again or browse the full shop.
        </Typography>
        <Link href="/shop" style={{ textDecoration: "none" }}>
          <Button variant="contained" sx={{ borderRadius: 999 }}>Browse the shop</Button>
        </Link>
      </Card>
    </Container>
  );
}

export default async function CategoryPage({ params }) {
  const { categoryId } = await params;
  const requestedSlug = slugify(categoryId);
  let products;

  try {
    products = await getCatalog();
  } catch (error) {
    console.error("Category page failed to load catalog:", error);
    return <CategoryError />;
  }

  const categoryProducts = products.filter((product) => slugify(product.category) === requestedSlug);
  if (!categoryProducts.length) notFound();

  const categoryName = categoryProducts[0].category;

  return (
    <Box sx={{ backgroundColor: "var(--color-background)", minHeight: "100vh", color: "var(--color-text-primary)", py: 5 }}>
      <Container maxWidth="lg">
        <Breadcrumbs sx={{ mb: 4, color: "var(--color-text-secondary)" }}>
          <Link href="/">Home</Link>
          <Link href="/shop">Shop</Link>
          <Typography color="var(--color-text-primary)">{categoryName}</Typography>
        </Breadcrumbs>

        <Box
          sx={{
            mb: 5,
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            background: "linear-gradient(135deg, var(--color-primary-soft), var(--color-accent-soft))",
            border: "1px solid var(--color-border)",
          }}
        >
          <Typography variant="overline" sx={{ letterSpacing: 3, color: "primary.light" }}>
            Weluxo collection
          </Typography>
          <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: "2.5rem", md: "4rem" }, mb: 1 }}>
            {categoryName}
          </Typography>
          <Typography sx={{ maxWidth: 700, color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Discover our {categoryName.toLowerCase()} collection, selected to help you move, train, recover, and perform at your best.
          </Typography>
          <Typography sx={{ mt: 2, color: "var(--color-text-secondary)" }}>
            {categoryProducts.length} {categoryProducts.length === 1 ? "product" : "products"}
          </Typography>
        </Box>

        <CategoryProductGrid products={categoryProducts} categoryName={categoryName} />
      </Container>
    </Box>
  );
}
