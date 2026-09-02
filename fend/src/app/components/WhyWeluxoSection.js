"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PublicIcon from "@mui/icons-material/Public";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import DesignServicesOutlinedIcon from "@mui/icons-material/DesignServicesOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import defaultContent from "../../../data/why-weluxo.json";

const shippingIcons = [PublicIcon, LocalShippingOutlinedIcon, Inventory2OutlinedIcon];
const qualityIcons = [AutoAwesomeOutlinedIcon, TuneOutlinedIcon, DesignServicesOutlinedIcon];

function EditButton({ onClick, editable }) {
  if (!editable || !onClick) return null;
  return (
    <IconButton
      size="small"
      aria-label="Edit section"
      onClick={onClick}
      sx={{
        position: "absolute",
        top: 12,
        right: 12,
        color: "var(--color-text-primary)",
        bgcolor: "#ffffff",
        zIndex: 2,
          "&:hover": { bgcolor: "var(--color-surface-muted)" },
      }}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  );
}

function Paragraphs({ text, sx = {} }) {
  return (
    <>
      {String(text || "")
        .split("\n\n")
        .filter(Boolean)
        .map((paragraph, index) => (
          <Typography key={index} sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, mb: 2, ...sx }}>
            {paragraph}
          </Typography>
        ))}
    </>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: "var(--color-primary)", fontWeight: 800, letterSpacing: "0.14em", display: "block", mb: 1 }}
    >
      {children}
    </Typography>
  );
}

export default function WhyWeluxoSection({ initialContent = null, onEdit = {}, editable = false }) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (initialContent) {
      queueMicrotask(() => setContent(initialContent));
      return;
    }
    let mounted = true;
    fetch("/api/dashboard/why-weluxo")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setContent(defaultContent));
    return () => {
      mounted = false;
    };
  }, [initialContent]);

  const data = content || defaultContent;
  const hero = data.hero || defaultContent.hero;
  const curated = data.curatedProducts || defaultContent.curatedProducts;
  const shopping = data.smartShopping || defaultContent.smartShopping;
  const shipping = data.globalShipping || defaultContent.globalShipping;
  const support = data.customerSupport || defaultContent.customerSupport;
  const quality = data.qualityFocus || defaultContent.qualityFocus;
  const secure = data.secureShopping || defaultContent.secureShopping;
  const promise = data.promise || defaultContent.promise;
  const finalCta = data.finalCta || defaultContent.finalCta;
  const shoppingItems = Array.isArray(shopping.items) ? shopping.items : [];
  const shippingCards = Array.isArray(shipping.cards) ? shipping.cards : [];
  const supportItems = Array.isArray(support.items) ? support.items : [];
  const supportLinks = Array.isArray(support.links) ? support.links : [];
  const qualityCards = Array.isArray(quality.cards) ? quality.cards : [];
  const secureItems = Array.isArray(secure.items) ? secure.items : [];

  return (
    <Box sx={{ bgcolor: "var(--color-background)", color: "var(--color-text-primary)", minHeight: "100vh", fontFamily: "var(--site-font-family, 'Space Grotesk','Segoe UI',sans-serif)" }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
            gap: { xs: 3, md: 6 },
            alignItems: "stretch",
            bgcolor: "#ffffff",
            color: "var(--color-text-primary)",
            borderRadius: { xs: 3, md: 5 },
            overflow: "hidden",
            position: "relative",
          }}
        >
          <EditButton onClick={onEdit.hero} editable={editable} />
          <Box sx={{ p: { xs: 3, md: 7 }, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <SectionLabel>{hero.eyebrow || "Why Weluxo"}</SectionLabel>
            <Typography variant="h1" sx={{ fontSize: { xs: "2.8rem", md: "5rem" }, lineHeight: 0.98, letterSpacing: "-0.05em", fontWeight: 800, maxWidth: 620 }}>
              {hero.title}
            </Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", fontSize: { xs: "1rem", md: "1.15rem" }, lineHeight: 1.75, maxWidth: 560, mt: 3 }}>
              {hero.subtitle}
            </Typography>
          </Box>
          <Box sx={{ minHeight: { xs: 270, md: 480 }, position: "relative" }}>
            <Box component="img" src={hero.image} alt={hero.alt || hero.title} sx={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 45%)" }} />
          </Box>
        </Box>

        <Box sx={{ py: { xs: 7, md: 11 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.75fr 1.25fr" }, gap: { xs: 3, md: 8 }, position: "relative" }}>
          <EditButton onClick={onEdit.curatedProducts} editable={editable} />
          <Box>
            <SectionLabel>{curated.eyebrow}</SectionLabel>
            <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2.2rem", md: "3.5rem" }, lineHeight: 1.02 }}>
              {curated.title}
            </Typography>
          </Box>
          <Box sx={{ pt: { md: 1 } }}><Paragraphs text={curated.copy} /></Box>
        </Box>

        <Box sx={{ bgcolor: "var(--color-accent-soft)", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 6 }, position: "relative" }}>
          <EditButton onClick={onEdit.smartShopping} editable={editable} />
          <Box sx={{ maxWidth: 660, mb: 4 }}>
            <SectionLabel>{shopping.eyebrow}</SectionLabel>
            <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2rem", md: "3.2rem" }, lineHeight: 1.05 }}>
              {shopping.title}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {shoppingItems.map((item, index) => (
              <Grid
                key={`${item}-${index}`}
                size={{
                  xs: 12,
                  sm: 6
                }}>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 2.25, bgcolor: "rgba(255,255,255,0.72)", borderRadius: 2.5, height: "100%" }}>
                  <CheckCircleOutlineIcon sx={{ color: "var(--color-primary)", mt: 0.15 }} />
                  <Typography sx={{ fontWeight: 650, lineHeight: 1.5 }}>{item}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box sx={{ py: { xs: 7, md: 11 }, position: "relative" }}>
          <EditButton onClick={onEdit.globalShipping} editable={editable} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.8fr 1.2fr" }, gap: { xs: 3, md: 8 }, mb: 5 }}>
            <Box>
              <SectionLabel>{shipping.eyebrow}</SectionLabel>
              <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2.2rem", md: "3.5rem" }, lineHeight: 1.02 }}>{shipping.title}</Typography>
            </Box>
            <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, maxWidth: 520 }}>{shipping.copy}</Typography>
          </Box>
          <Grid container spacing={2}>
            {shippingCards.map((card, index) => {
              const Icon = shippingIcons[index % shippingIcons.length];
              return (
                <Grid
                  key={`${card.title}-${index}`}
                  size={{
                    xs: 12,
                    md: 4
                  }}>
                  <Card sx={{ height: "100%", borderRadius: 3, bgcolor: "#ffffff", border: "1px solid var(--color-border)", boxShadow: "none" }}>
                    <CardContent sx={{ p: 3 }}>
                      <Icon sx={{ color: "var(--color-accent)", fontSize: 34, mb: 3 }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{card.title}</Typography>
                      <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.65 }}>{card.copy}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <Box sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 6 }, position: "relative" }}>
          <EditButton onClick={onEdit.customerSupport} editable={editable} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.1fr" }, gap: { xs: 4, md: 10 } }}>
            <Box>
              <SectionLabel>{support.eyebrow}</SectionLabel>
              <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2.2rem", md: "3.5rem" }, lineHeight: 1.02, mb: 2 }}>{support.title}</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>{support.copy}</Typography>
            </Box>
            <Box>
              <Stack spacing={1.25} sx={{ mb: 4 }}>
                {supportItems.map((item, index) => (
                  <Typography key={`${item}-${index}`} sx={{ color: "var(--color-text-primary)", display: "flex", gap: 1.25, lineHeight: 1.5 }}>
                    <CheckCircleOutlineIcon sx={{ color: "var(--color-primary)", fontSize: 21 }} />{item}
                  </Typography>
                ))}
              </Stack>
              <Divider sx={{ borderColor: "var(--color-border)", mb: 2 }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
                {supportLinks.map((link, index) => (
                  <Button key={`${link.label}-${index}`} component={Link} href={link.url || "#"} endIcon={<ArrowOutwardIcon />} sx={{ color: "var(--color-primary)", justifyContent: "flex-start", textTransform: "none", px: 0, mr: 2 }}>
                    {link.label}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>

        <Box sx={{ py: { xs: 7, md: 11 }, position: "relative" }}>
          <EditButton onClick={onEdit.qualityFocus} editable={editable} />
          <Box sx={{ maxWidth: 680, mb: 5 }}>
            <SectionLabel>{quality.eyebrow}</SectionLabel>
            <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2.2rem", md: "3.5rem" }, lineHeight: 1.02, mb: 2 }}>{quality.title}</Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>{quality.copy}</Typography>
          </Box>
          <Grid container spacing={2}>
            {qualityCards.map((card, index) => {
              const Icon = qualityIcons[index % qualityIcons.length];
              return (
                <Grid
                  key={`${card.title}-${index}`}
                  size={{
                    xs: 12,
                    sm: 4
                  }}>
                  <Card sx={{ height: "100%", borderRadius: 3, bgcolor: "#ffffff", border: "1px solid var(--color-border)", boxShadow: "none" }}>
                    <CardContent sx={{ p: 3 }}>
                      <Icon sx={{ color: "var(--color-accent)", fontSize: 30, mb: 4 }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{card.title}</Typography>
                      <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.65 }}>{card.copy}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <Box sx={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)", py: { xs: 6, md: 8 }, position: "relative" }}>
          <EditButton onClick={onEdit.secureShopping} editable={editable} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.8fr 1.2fr" }, gap: { xs: 3, md: 8 }, alignItems: "center" }}>
            <Box>
              <SectionLabel>{secure.eyebrow}</SectionLabel>
              <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2.2rem", md: "3.5rem" }, lineHeight: 1.02 }}>{secure.title}</Typography>
            </Box>
            <Grid container spacing={1.5}>
              {secureItems.map((item, index) => (
                <Grid
                  key={`${item}-${index}`}
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 2, bgcolor: "#ffffff", border: "1px solid var(--color-border)", borderRadius: 2.5 }}>
                    {index === 0 ? <LockOutlinedIcon sx={{ color: "var(--color-primary)" }} /> : <CheckCircleOutlineIcon sx={{ color: "var(--color-primary)" }} />}
                    <Typography sx={{ fontWeight: 700 }}>{item}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>

        <Box sx={{ textAlign: "center", py: { xs: 8, md: 12 }, maxWidth: 760, mx: "auto", position: "relative" }}>
          <EditButton onClick={onEdit.promise} editable={editable} />
          <SectionLabel>{promise.eyebrow}</SectionLabel>
          <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: { xs: "2.5rem", md: "4.4rem" }, lineHeight: 1.02, mb: 3 }}>{promise.title}</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", fontSize: { xs: "1.05rem", md: "1.2rem" }, lineHeight: 1.8 }}>{promise.copy}</Typography>
        </Box>

        <Box sx={{ bgcolor: "var(--color-primary-soft)", border: "1px solid color-mix(in srgb, var(--color-primary) 16%, transparent)", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 6 }, textAlign: "center", position: "relative" }}>
          <EditButton onClick={onEdit.finalCta} editable={editable} />
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.03em", mb: 3 }}>{finalCta.title}</Typography>
          <Button component={Link} href={finalCta.buttonUrl || "/shop"} variant="contained" size="large" endIcon={<ArrowOutwardIcon />} sx={{ bgcolor: "var(--color-accent)", color: "var(--color-text-primary)", borderRadius: 999, px: 3.5, py: 1.25, textTransform: "none", fontWeight: 800, "&:hover": { bgcolor: "var(--color-accent-dark)" } }}>
            {finalCta.buttonText}
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
