
"use client";
import { useEffect, useState } from "react";
import { Container, Typography, Grid, Card, CardContent, CardMedia, Button } from "@mui/material";
import Header from "../components/Header";

export default function ShopPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/shop")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  return (
    <>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Shop
        </Typography>
        <Grid container spacing={3}>
          {Array.isArray(products) && products.length > 0 ? (
            products.map((product) => (
              <Grid item xs={12} sm={6} md={4} key={product.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height="140"
                    image={product.Img || "https://via.placeholder.com/150"}
                    alt={product.alt || "Product image"}
                  />
                  <CardContent>
                    <Typography variant="h6">{product.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.price}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.Description}
                    </Typography>
                    <Button variant="contained" color="primary" sx={{ mt: 1 }}>
                      Add to Cart
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : (
            <Typography variant="body1" color="text.secondary">No products found.</Typography>
          )}
        </Grid>
      </Container>
    </>
  );
}