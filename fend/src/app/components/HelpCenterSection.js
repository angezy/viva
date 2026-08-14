"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
import DevicesOtherOutlinedIcon from "@mui/icons-material/DevicesOtherOutlined";
import EditIcon from "@mui/icons-material/Edit";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import SearchIcon from "@mui/icons-material/Search";
import defaultContent from "../../../data/help-center.json";

const quickActionIcons = [LocalShippingOutlinedIcon, LocalShippingOutlinedIcon, ReplayOutlinedIcon, DevicesOtherOutlinedIcon, ContactMailOutlinedIcon];

function faqAnchorId(question) {
  return `help-faq-${String(question || "question")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function EditButton({ onClick, editable }) {
  if (!editable || !onClick) return null;
  return (
    <IconButton
      size="small"
      aria-label="Edit section"
      onClick={onClick}
      sx={{ position: "absolute", top: 12, right: 12, zIndex: 3, color: "#173a2b", bgcolor: "rgba(255,255,255,0.94)", "&:hover": { bgcolor: "white" } }}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  );
}

function Label({ children, light = false }) {
  return <Typography variant="overline" sx={{ color: light ? "#a8d8b8" : "#3e785e", letterSpacing: "0.14em", fontWeight: 800, display: "block", mb: 1 }}>{children}</Typography>;
}

function ActionButton({ href, children, variant = "contained" }) {
  return (
    <Button
      component={Link}
      href={href || "/shop"}
      variant={variant}
      endIcon={<ArrowForwardIcon />}
      sx={{ borderRadius: 999, px: 2.25, py: 1.1, textTransform: "none", fontWeight: 800, ...(variant === "contained" ? { bgcolor: "#12372a", "&:hover": { bgcolor: "#1b503b" } } : { color: "#12372a", borderColor: "#8eaf96" }) }}
    >
      {children}
    </Button>
  );
}

export default function HelpCenterSection({ initialContent = null, onEdit = {}, editable = false }) {
  const [content, setContent] = useState(initialContent || defaultContent);
  const [query, setQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState(0);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }
    let mounted = true;
    fetch("/api/dashboard/help-center")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setContent(defaultContent));
    return () => {
      mounted = false;
    };
  }, [initialContent]);

  const data = content || defaultContent;
  const hero = data.hero || defaultContent.hero;
  const quickActions = data.quickActions || defaultContent.quickActions;
  const categories = Array.isArray(data.categories?.items) ? data.categories.items : [];
  const categoryContent = data.categories || defaultContent.categories;
  const faq = data.faq || defaultContent.faq;
  const faqItems = Array.isArray(faq.items) ? faq.items : [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCategories = categories
    .map((category) => {
      const titleMatches = String(category.title || "").toLowerCase().includes(normalizedQuery);
      const articles = Array.isArray(category.articles) ? category.articles : [];
      return { ...category, articles: titleMatches ? articles : articles.filter((article) => String(article).toLowerCase().includes(normalizedQuery)) };
    })
    .filter((category) => !normalizedQuery || String(category.title || "").toLowerCase().includes(normalizedQuery) || category.articles.length > 0);
  const visibleFaq = normalizedQuery ? faqItems.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery)) : faqItems;

  const openFaqAnswer = (event, article) => {
    const target = faqItems.find((item) => String(item.question || "").trim().toLowerCase() === String(article || "").trim().toLowerCase());
    event.preventDefault();
    setQuery("");
    if (!target) {
      document.getElementById("help-faq-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const targetIndex = faqItems.indexOf(target);
    setExpandedFaq(targetIndex);
    window.setTimeout(() => document.getElementById(faqAnchorId(target.question))?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <Box component="main" sx={{ bgcolor: "#f6f9f5", color: "#12372a", minHeight: "100vh", fontFamily: "'Space Grotesk','Segoe UI',sans-serif" }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
        <Box component="header" sx={{ position: "relative", bgcolor: "#0e2b20", color: "white", borderRadius: { xs: 3, md: 5 }, overflow: "hidden", p: { xs: 3, md: 7 }, mb: { xs: 6, md: 9 } }}>
          <Box sx={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", bgcolor: "rgba(168,216,184,0.15)", top: -230, right: -100 }} />
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 850 }}>
            <EditButton onClick={onEdit.hero} editable={editable} />
            <Label light>{hero.eyebrow}</Label>
            <Typography component="h1" sx={{ fontWeight: 850, letterSpacing: "-0.055em", fontSize: { xs: "2.75rem", sm: "3.7rem", md: "5.2rem" }, lineHeight: 0.98, maxWidth: 720 }}>{hero.title}</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.8, maxWidth: 660, mt: 3, fontSize: { xs: "1rem", md: "1.1rem" } }}>{hero.copy}</Typography>
            <TextField
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={hero.searchPlaceholder}
              aria-label="Search help"
              sx={{ mt: 4, maxWidth: 760, bgcolor: "white", borderRadius: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 }, "& .MuiInputBase-input": { py: 1.8 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#3e785e" }} /></InputAdornment> }}
            />
            {normalizedQuery && <Typography sx={{ color: "#cbe8d2", fontSize: 13, mt: 1.5 }}>{visibleCategories.reduce((count, category) => count + category.articles.length, 0) + visibleFaq.length} results for “{query}”</Typography>}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="quick-actions-title" sx={{ mb: { xs: 8, md: 12 } }}>
          <Label>{quickActions.eyebrow}</Label>
          <Typography id="quick-actions-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.25rem", md: "3.6rem" }, lineHeight: 1.02, mb: 4 }}>{quickActions.title}</Typography>
          <Grid container spacing={2}>
            {(Array.isArray(quickActions.cards) ? quickActions.cards : []).map((card, index) => {
              const Icon = quickActionIcons[index % quickActionIcons.length];
              return (
                <Grid item xs={12} sm={6} md={index === 4 ? 12 : 3} key={`${card.title}-${index}`}>
                  <Card sx={{ height: "100%", borderRadius: 3, border: "1px solid #dbe7dc", bgcolor: index % 2 ? "#e4efe6" : "white", boxShadow: "none", transition: "transform 180ms ease, box-shadow 180ms ease", "&:hover": { transform: "translateY(-4px)", boxShadow: "0 14px 30px rgba(18,55,42,0.1)" } }}>
                    <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
                      <Icon sx={{ color: "#3e785e", fontSize: 30, mb: 3 }} />
                      <Typography component="h3" sx={{ fontWeight: 800, mb: 1 }}>{card.title}</Typography>
                      <Typography sx={{ color: "#607267", lineHeight: 1.65, fontSize: 14, mb: 3 }}>{card.description}</Typography>
                      <Box sx={{ mt: "auto" }}><ActionButton href={card.href} variant="outlined">{card.button}</ActionButton></Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <Box component="section" aria-labelledby="help-categories-title" sx={{ position: "relative", mb: { xs: 8, md: 12 } }}>
          <EditButton onClick={onEdit.categories} editable={editable} />
          <Box sx={{ maxWidth: 760, mb: 4 }}>
            <Label>{categoryContent.eyebrow}</Label>
            <Typography id="help-categories-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.25rem", md: "3.6rem" }, lineHeight: 1.02, mb: 1.5 }}>{categoryContent.title}</Typography>
            <Typography sx={{ color: "#52645a", lineHeight: 1.8 }}>{categoryContent.copy}</Typography>
          </Box>
          <Box>
            {visibleCategories.map((category, index) => (
              <Accordion key={`${category.title}-${index}`} expanded={expandedCategory === index} onChange={() => setExpandedCategory(expandedCategory === index ? -1 : index)} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderTop: "1px solid #d7e3d8", "&:last-child": { borderBottom: "1px solid #d7e3d8" }, "&::before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ChevronRightIcon />} aria-controls={`category-panel-${index}`} id={`category-header-${index}`} sx={{ px: 0, py: 1.2, minHeight: 68 }}>
                  <Typography component="h3" sx={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{category.title}</Typography>
                </AccordionSummary>
                <AccordionDetails id={`category-panel-${index}`} sx={{ px: 0, pt: 0, pb: 3 }}>
                  {category.articles.length > 0 ? (
                    <Grid container spacing={1.25}>
                      {category.articles.map((article, articleIndex) => (
                        <Grid item xs={12} sm={6} key={`${article}-${articleIndex}`}>
                          <Box component="a" href={faqItems.some((item) => String(item.question || "").trim().toLowerCase() === String(article || "").trim().toLowerCase()) ? `#${faqAnchorId(article)}` : "#help-faq-title"} onClick={(event) => openFaqAnswer(event, article)} sx={{ display: "block", width: "100%", textAlign: "left", border: "1px solid #dbe7dc", bgcolor: "white", color: "#365345", borderRadius: 2, p: 1.75, cursor: "pointer", font: "inherit", textDecoration: "none", transition: "border-color 160ms ease, color 160ms ease", "&:hover": { borderColor: "#6f9a7b", color: "#12372a" } }}>
                            {article}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ) : <Typography sx={{ color: "#607267" }}>No matching articles in this category.</Typography>}
                </AccordionDetails>
              </Accordion>
            ))}
            {normalizedQuery && visibleCategories.length === 0 && <Typography sx={{ color: "#607267", py: 3 }}>No matching help articles were found. Try another search or use the AI Concierge.</Typography>}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="help-faq-title" sx={{ maxWidth: 920, mx: "auto", position: "relative", mb: { xs: 8, md: 12 } }}>
          <EditButton onClick={onEdit.faq} editable={editable} />
          <Label>{faq.eyebrow}</Label>
          <Typography id="help-faq-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.25rem", md: "3.6rem" }, lineHeight: 1.02, mb: 4 }}>{faq.title}</Typography>
          {(normalizedQuery ? visibleFaq : faqItems).map((item, index) => (
            <Accordion key={`${item.question}-${index}`} id={faqAnchorId(item.question)} expanded={expandedFaq === index} onChange={() => setExpandedFaq(expandedFaq === index ? -1 : index)} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderTop: "1px solid #d7e3d8", scrollMarginTop: 24, "&:last-child": { borderBottom: "1px solid #d7e3d8" }, "&::before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ChevronRightIcon />} aria-controls={`help-faq-panel-${index}`} id={`help-faq-header-${index}`} sx={{ px: 0, py: 1.2, minHeight: 68 }}><Typography component="h3" sx={{ fontWeight: 750 }}>{item.question}</Typography></AccordionSummary>
              <AccordionDetails id={`help-faq-panel-${index}`} sx={{ px: 0, pt: 0, pb: 2.5 }}><Typography sx={{ color: "#52645a", lineHeight: 1.8, maxWidth: 780 }}>{item.answer}</Typography></AccordionDetails>
            </Accordion>
          ))}
          {normalizedQuery && visibleFaq.length === 0 && <Typography sx={{ color: "#607267", py: 3 }}>No matching FAQ answers were found.</Typography>}
        </Box>
      </Container>
    </Box>
  );
}
