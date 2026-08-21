"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Box, Button, Card, CardContent, Container, Grid, InputAdornment, TextField, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import defaultHelpCenter from "../../../../data/help-center.json";

const actions = [
  ["Order Tracking", "Check delivery status and tracking updates.", "/tracking"],
  ["Shipping & Delivery", "Get clear delivery timing and destination information.", "/shipping-information"],
  ["Returns & Refunds", "Understand returns, exchanges, and refund timing.", "/returns"],
  ["Product Support", "Find product guidance and troubleshooting help.", "/shop"],
  ["Payment Issues", "Get help with checkout and payment questions.", "/payment-security"],
  ["Warranty", "Learn what support is available for your product.", "/warranty"],
  ["Account Support", "Manage your profile or get account assistance.", "/account"],
];

export default function SupportPortalSection() {
  const [content, setContent] = useState(defaultHelpCenter);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/help-center")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setContent)
      .catch(() => setContent(defaultHelpCenter));
  }, []);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    const categories = Array.isArray(content?.categories?.items) ? content.categories.items : [];
    const faqs = Array.isArray(content?.faq?.items) ? content.faq.items : [];
    if (!value) return [];
    return [
      ...categories.flatMap((category) => (category.articles || []).filter((article) => String(article).toLowerCase().includes(value)).map((article) => ({ title: article, href: "/help-center#help-categories-title" }))),
      ...faqs.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(value)).map((item) => ({ title: item.question, href: "/help-center#help-faq-title" })),
    ].slice(0, 8);
  }, [content, query]);

  return (
    <Box component="main" sx={{ bgcolor: "var(--color-background)", minHeight: "100vh", color: "var(--color-text-primary)", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 7 }, position: "relative", overflow: "hidden", mb: 6 }}>
          <Box sx={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", bgcolor: "rgba(242,140,40,0.12)", right: -90, top: -200 }} />
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 820 }}>
            <Typography variant="overline" sx={{ color: "var(--color-accent)", fontWeight: 800, letterSpacing: "0.14em" }}>WELUXO CUSTOMER SUPPORT</Typography>
            <Typography component="h1" sx={{ fontWeight: 850, letterSpacing: "-0.055em", fontSize: { xs: "2.8rem", md: "5rem" }, lineHeight: 0.98, mt: 1 }}>How can we help?</Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, mt: 2, maxWidth: 620 }}>Search help articles before opening a ticket, or connect with our support team when you need a human answer.</Typography>
            <TextField fullWidth value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help articles, orders, shipping, products..." aria-label="Search support articles" sx={{ mt: 4, bgcolor: "#ffffff", borderRadius: 2, maxWidth: 760, "& .MuiOutlinedInput-root": { borderRadius: 2 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "var(--color-primary)" }} /></InputAdornment> }} />
            {results.length > 0 && <Box sx={{ mt: 1, bgcolor: "#ffffff", color: "var(--color-text-primary)", borderRadius: 2, overflow: "hidden", maxWidth: 760 }}>{results.map((result) => <Button key={result.title} component={Link} href={result.href} fullWidth sx={{ justifyContent: "flex-start", textTransform: "none", color: "var(--color-primary)", px: 2, py: 1.25 }}>{result.title}</Button>)}</Box>}
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, gap: 2, flexDirection: { xs: "column", md: "row" }, mb: 3 }}>
          <Box><Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 800, letterSpacing: "0.14em" }}>QUICK ACTIONS</Typography><Typography component="h2" sx={{ fontWeight: 820, fontSize: { xs: "2rem", md: "3rem" }, letterSpacing: "-0.04em" }}>Start with the right place.</Typography></Box>
          <Button component={Link} href="/support/new-ticket" variant="contained" startIcon={<SupportAgentOutlinedIcon />} sx={{ borderRadius: 999, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800, px: 2.25 }}>Create a support ticket</Button>
        </Box>
        <Grid container spacing={2}>
          {actions.map(([title, description, href], index) => <Grid item xs={12} sm={6} md={index === 6 ? 12 : 3} key={title}><Card sx={{ height: "100%", bgcolor: index % 2 ? "var(--color-accent-soft)" : "#ffffff", border: "1px solid var(--color-border)", borderRadius: 3, boxShadow: "none" }}><CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}><Typography component="h3" sx={{ fontWeight: 800, mb: 1 }}>{title}</Typography><Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.65, fontSize: 14, mb: 3 }}>{description}</Typography><Button component={Link} href={href} endIcon={<ArrowForwardIcon />} sx={{ mt: "auto", alignSelf: "flex-start", color: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>Open help</Button></CardContent></Card></Grid>)}
        </Grid>
      </Container>
    </Box>
  );
}
