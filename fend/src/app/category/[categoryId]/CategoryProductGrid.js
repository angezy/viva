"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
} from "@mui/material";

export default function CategoryProductGrid({ products = [], categoryName = "Collection" }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filteredProducts = useMemo(
    () => products.filter((product) => {
      if (!query) return true;
      return `${product.title} ${product.brand} ${product.description}`.toLowerCase().includes(query);
    }),
    [products, query]
  );

  return (
    <Box component="section" aria-labelledby="category-products-title">
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 2, mb: 3, flexDirection: { xs: "column", sm: "row" } }}>
        <Box>
          <Typography id="category-products-title" variant="h5" sx={{ fontWeight: 800 }}>
            Browse {categoryName} products
          </Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", mt: 0.5 }}>
            {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} in this collection
          </Typography>
        </Box>
        <TextField
          label={`Search ${categoryName}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          sx={{ minWidth: { xs: "100%", sm: 280 }, backgroundColor: "#ffffff", borderRadius: 1, input: { color: "var(--color-text-primary)" }, label: { color: "var(--color-text-secondary)" }, fieldset: { borderColor: "var(--color-border)" } }}
        />
      </Box>

      {filteredProducts.length === 0 ? (
        <Box sx={{ p: 4, borderRadius: 3, border: "1px dashed var(--color-border)", bgcolor: "var(--color-surface-muted)" }}>
          <Typography sx={{ color: "var(--color-text-secondary)" }}>No products match your search in this category.</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredProducts.map((product) => (
            <Grid item xs={12} sm={6} md={4} key={product.id}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 4, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                <Link href={`/product/${product.slug}`}>
                  <Box component="img" src={product.image} alt={product.alt} sx={{ display: "block", width: "100%", height: 250, objectFit: "cover" }} />
                </Link>
                <CardContent sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                  <Typography variant="overline" sx={{ color: "secondary.light", letterSpacing: 1.5 }}>{product.brand}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{product.title}</Typography>
                  <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden", minHeight: 60 }}>
                    {product.description}
                  </Typography>
                  <Box sx={{ mt: "auto", pt: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>${product.price.toFixed(2)}</Typography>
                    <Button href={`/product/${product.slug}`} variant="contained" sx={{ borderRadius: 999, textTransform: "none" }}>View product</Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
