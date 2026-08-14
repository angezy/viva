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
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import EditIcon from "@mui/icons-material/Edit";
import defaultContent from "../../../data/how-it-works.json";

const stepIcons = [
  ExploreOutlinedIcon,
  TuneOutlinedIcon,
  LockOutlinedIcon,
  Inventory2OutlinedIcon,
  LocalShippingOutlinedIcon,
  AutoAwesomeOutlinedIcon,
];

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
        color: "#16352a",
        bgcolor: "rgba(255,255,255,0.94)",
        zIndex: 3,
        "&:hover": { bgcolor: "white" },
      }}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  );
}

function Label({ children, light = false }) {
  return (
    <Typography
      variant="overline"
      sx={{
        color: light ? "#a8d8b8" : "#3e785e",
        letterSpacing: "0.14em",
        fontWeight: 800,
        display: "block",
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function Paragraphs({ text, light = false }) {
  return String(text || "")
    .split("\n\n")
    .filter(Boolean)
    .map((paragraph, index) => (
      <Typography
        key={index}
        sx={{
          color: light ? "rgba(255,255,255,0.76)" : "#52645a",
          lineHeight: 1.8,
          mb: 2,
        }}
      >
        {paragraph}
      </Typography>
    ));
}

function ActionButton({ href, children, variant = "contained", light = false }) {
  return (
    <Button
      component={Link}
      href={href || "/shop"}
      variant={variant}
      endIcon={<ArrowForwardIcon />}
      sx={{
        borderRadius: 999,
        px: 2.5,
        py: 1.15,
        textTransform: "none",
        fontWeight: 800,
        ...(light && variant === "outlined"
          ? { color: "white", borderColor: "rgba(255,255,255,0.35)" }
          : {}),
        ...(light && variant === "contained"
          ? { bgcolor: "#cbe8d2", color: "#12372a", "&:hover": { bgcolor: "#e1f2e4" } }
          : {}),
      }}
    >
      {children}
    </Button>
  );
}

function FlowVisual({ step, index }) {
  const Icon = stepIcons[index % stepIcons.length];
  const flow = Array.isArray(step.flow) ? step.flow : [];
  return (
    <Box
      sx={{
        minHeight: { xs: 280, md: 390 },
        bgcolor: index % 2 ? "#e4efe6" : "#dcebe0",
        borderRadius: { xs: 3, md: 4 },
        p: { xs: 2.5, md: 4 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box sx={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.5)", top: -90, right: -70 }} />
      <Box sx={{ position: "relative", zIndex: 1 }}>
        <Box sx={{ width: 54, height: 54, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "#12372a", color: "#cbe8d2", mb: 4 }}>
          <Icon />
        </Box>
        {step.image ? (
          <Box component="img" src={step.image} alt={step.alt || step.title} loading="lazy" sx={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 2.5, display: "block", mb: 3 }} />
        ) : (
          <Stack spacing={1.25} sx={{ mb: 2 }}>
            {flow.map((item, flowIndex) => (
              <Box key={`${item}-${flowIndex}`} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#12372a", color: "#cbe8d2", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                  {String(flowIndex + 1).padStart(2, "0")}
                </Box>
                <Typography sx={{ fontWeight: 750, color: "#183f2e" }}>{item}</Typography>
                {flowIndex < flow.length - 1 && <ChevronRightIcon sx={{ color: "#6e9880", ml: "auto" }} />}
              </Box>
            ))}
          </Stack>
        )}
        <Typography sx={{ color: "#5b7565", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}>
          Weluxo process / {step.number}
        </Typography>
      </Box>
    </Box>
  );
}

export default function HowItWorksSection({ initialContent = null, onEdit = {}, editable = false }) {
  const [content, setContent] = useState(initialContent || defaultContent);
  const [expandedFaq, setExpandedFaq] = useState(0);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }
    let mounted = true;
    fetch("/api/dashboard/how-it-works")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setContent(defaultContent));
    return () => {
      mounted = false;
    };
  }, [initialContent]);

  const data = content || defaultContent;
  const hero = data.hero || defaultContent.hero;
  const overview = data.processOverview || defaultContent.processOverview;
  const detailSteps = Array.isArray(data.detailSteps) ? data.detailSteps : defaultContent.detailSteps;
  const support = data.support || defaultContent.support;
  const way = data.way || defaultContent.way;
  const faq = data.faq || defaultContent.faq;
  const finalCta = data.finalCta || defaultContent.finalCta;
  const overviewSteps = Array.isArray(overview.steps) ? overview.steps : [];
  const supportLinks = Array.isArray(support.links) ? support.links : [];
  const principles = Array.isArray(way.principles) ? way.principles : [];
  const faqItems = Array.isArray(faq.items) ? faq.items : [];
  const heroFlow = Array.isArray(hero.flow) && hero.flow.length ? hero.flow : overviewSteps;

  return (
    <Box component="main" sx={{ bgcolor: "#f6f9f5", color: "#12372a", minHeight: "100vh", fontFamily: "'Space Grotesk','Segoe UI',sans-serif" }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
        <Box component="section" aria-labelledby="how-it-works-title" sx={{ position: "relative", bgcolor: "#0e2b20", color: "white", borderRadius: { xs: 3, md: 5 }, overflow: "hidden", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.04fr 0.96fr" }, minHeight: { md: 550 } }}>
          <EditButton onClick={onEdit.hero} editable={editable} />
          <Box sx={{ p: { xs: 3, md: 7 }, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
            <Label light>{hero.eyebrow}</Label>
            <Typography id="how-it-works-title" component="h1" sx={{ fontWeight: 850, letterSpacing: "-0.055em", fontSize: { xs: "2.85rem", sm: "3.7rem", md: "5rem" }, lineHeight: 0.98, maxWidth: 650 }}>
              {hero.title}
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.77)", lineHeight: 1.78, maxWidth: 560, mt: 3, fontSize: { xs: "1rem", md: "1.1rem" } }}>
              {hero.copy}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 3.5, alignItems: { xs: "stretch", sm: "center" } }}>
              <ActionButton href={hero.primaryUrl} light>{hero.primaryCta}</ActionButton>
              <ActionButton href={hero.secondaryUrl} variant="outlined" light>{hero.secondaryCta}</ActionButton>
            </Stack>
          </Box>
          <Box sx={{ minHeight: { xs: 300, md: "auto" }, position: "relative", overflow: "hidden" }}>
            <Box component="img" src={hero.image} alt={hero.alt || hero.title} loading="eager" sx={{ width: "100%", height: "100%", minHeight: { xs: 300, md: 550 }, display: "block", objectFit: "cover", opacity: 0.82 }} />
            <Box sx={{ position: "absolute", inset: 0, background: { xs: "linear-gradient(180deg, rgba(14,43,32,0.06), rgba(14,43,32,0.38))", md: "linear-gradient(90deg, rgba(14,43,32,0.68), rgba(14,43,32,0.05) 60%)" } }} />
            <Box sx={{ position: "absolute", left: { xs: 18, md: 32 }, right: { xs: 18, md: 32 }, bottom: { xs: 18, md: 32 }, p: 2, border: "1px solid rgba(255,255,255,0.28)", bgcolor: "rgba(14,43,32,0.68)", backdropFilter: "blur(12px)", borderRadius: 2.5 }}>
              <Typography sx={{ color: "#cbe8d2", fontSize: 11, letterSpacing: "0.12em", fontWeight: 800, mb: 1 }}>DISCOVER → DELIVERY</Typography>
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                {heroFlow.map((item, index) => {
                  const label = typeof item === "string" ? item : item.label;
                  return <Typography key={`${label}-${index}`} sx={{ color: "white", fontSize: 13, fontWeight: 700 }}>{label}{index < heroFlow.length - 1 ? "  →" : ""}</Typography>;
                })}
              </Stack>
            </Box>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="process-overview-title" sx={{ position: "relative", py: { xs: 3, md: 4 }, px: { xs: 2, md: 4 }, bgcolor: "#e4efe6", border: "1px solid #d2e2d5", borderRadius: { xs: 3, md: 4 }, overflow: "hidden" }}>
          <EditButton onClick={onEdit.processOverview} editable={editable} />
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "end" }, gap: 2, mb: { xs: 4, md: 5 }, flexDirection: { xs: "column", md: "row" }, pr: 4 }}>
            <Box>
              <Label>{overview.eyebrow}</Label>
              <Typography id="process-overview-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.04em", fontSize: { xs: "2rem", md: "3rem" }, lineHeight: 1.05 }}>{overview.title}</Typography>
            </Box>
            <Typography sx={{ color: "#6a7b70", fontSize: 12, letterSpacing: "0.1em", fontWeight: 800 }}>01 — 05 / THE JOURNEY</Typography>
          </Box>
          <Box component="ol" sx={{ display: "flex", overflowX: "auto", listStyle: "none", p: 0, m: 0, pb: 1, "&::-webkit-scrollbar": { height: 6 }, "&::-webkit-scrollbar-thumb": { bgcolor: "#b7cfbc", borderRadius: 4 } }}>
            {overviewSteps.map((step, index) => (
              <Box component="li" key={`${step.label}-${index}`} sx={{ minWidth: { xs: 135, md: "auto" }, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", textAlign: "center", "&:not(:last-child)::after": { content: '""', position: "absolute", top: 20, left: "calc(50% + 22px)", right: "calc(-50% + 22px)", height: 2, bgcolor: "#b7cfbc" } }}>
                <Box sx={{ position: "relative", zIndex: 1, width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#12372a", color: "#cbe8d2", fontSize: 12, fontWeight: 850, boxShadow: "0 0 0 5px #e4efe6", mb: 1.5 }}>{step.number}</Box>
                <Typography sx={{ fontWeight: 800, whiteSpace: "nowrap", color: "#173a2b" }}>{step.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="details-title" sx={{ position: "relative" }}>
          <Typography id="details-title" component="h2" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>How the Weluxo shopping process works</Typography>
          <Stack spacing={{ xs: 7, md: 12 }}>
            {detailSteps.map((step, index) => {
              const items = Array.isArray(step.items) ? step.items : [];
              const isReverse = index % 2 === 1;
              return (
                <Box component="article" id={`how-step-${step.id || index + 1}`} key={step.id || index} sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 3, md: 7 }, alignItems: "center" }}>
                  <EditButton onClick={() => onEdit.step?.(index)} editable={editable} />
                  <Box sx={{ order: { xs: 1, md: isReverse ? 2 : 1 } }}>
                    <Label>{step.eyebrow || `STEP ${step.number}`}</Label>
                    <Typography component="h3" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.25rem", md: "3.5rem" }, lineHeight: 1.02, mb: 2 }}>{step.title}</Typography>
                    <Paragraphs text={step.copy} />
                    {items.length > 0 && (
                      <Grid container spacing={1} sx={{ mt: 1, mb: 3 }}>
                        {items.map((item, itemIndex) => (
                          <Grid item xs={12} sm={6} key={`${item}-${itemIndex}`}>
                            <Typography sx={{ display: "flex", gap: 1, color: "#3f5d4b", fontWeight: 650, fontSize: 14, lineHeight: 1.45 }}>
                              <CheckCircleOutlineIcon sx={{ color: "#3e785e", fontSize: 20, flexShrink: 0 }} />{item}
                            </Typography>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                    {step.ctaText && <ActionButton href={step.ctaUrl} variant="outlined">{step.ctaText}</ActionButton>}
                  </Box>
                  <Box sx={{ order: { xs: 2, md: isReverse ? 1 : 2 } }}><FlowVisual step={step} index={index} /></Box>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Box component="section" aria-labelledby="support-title" sx={{ bgcolor: "#12372a", color: "white", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 6 }, my: { xs: 8, md: 12 }, position: "relative" }}>
          <EditButton onClick={onEdit.support} editable={editable} />
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Label light>{support.eyebrow}</Label>
              <Typography id="support-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.3rem", md: "3.4rem" }, lineHeight: 1.02, mb: 2 }}>{support.title}</Typography>
              <Paragraphs text={support.copy} light />
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack divider={<Divider flexItem sx={{ borderColor: "rgba(255,255,255,0.16)" }} />}>
                {supportLinks.map((link, index) => (
                  <Button key={`${link.label}-${index}`} component={Link} href={link.url || "/contact"} endIcon={<ArrowForwardIcon />} sx={{ color: "#d5f0db", justifyContent: "space-between", textTransform: "none", fontWeight: 750, py: 1.7, px: 0, fontSize: { xs: "1rem", md: "1.1rem" } }}>
                    {link.label}
                  </Button>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>

        <Box component="section" aria-labelledby="way-title" sx={{ py: { xs: 2, md: 3 }, position: "relative" }}>
          <EditButton onClick={onEdit.way} editable={editable} />
          <Box sx={{ maxWidth: 720, mb: 5 }}>
            <Label>{way.eyebrow}</Label>
            <Typography id="way-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.35rem", md: "3.8rem" }, lineHeight: 1.02 }}>{way.title}</Typography>
          </Box>
          <Grid container spacing={2}>
            {principles.map((principle, index) => {
              const Icon = [ExploreOutlinedIcon, AutoAwesomeOutlinedIcon, ShoppingBagOutlinedIcon, PublicOutlinedIcon][index % 4];
              return (
                <Grid item xs={12} sm={6} md={3} key={`${principle.title}-${index}`}>
                  <Card sx={{ height: "100%", borderRadius: 3, bgcolor: index % 2 ? "#e4efe6" : "#fff", border: "1px solid #dbe7dc", boxShadow: "none" }}>
                    <CardContent sx={{ p: 3 }}>
                      <Icon sx={{ color: "#3e785e", fontSize: 30, mb: 5 }} />
                      <Typography component="h3" sx={{ fontWeight: 800, mb: 1 }}>{principle.title}</Typography>
                      <Typography sx={{ color: "#607267", lineHeight: 1.65, fontSize: 14 }}>{principle.copy}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <Box component="section" aria-labelledby="faq-title" sx={{ maxWidth: 900, mx: "auto", py: { xs: 8, md: 12 }, position: "relative" }}>
          <EditButton onClick={onEdit.faq} editable={editable} />
          <Label>{faq.eyebrow}</Label>
          <Typography id="faq-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.25rem", md: "3.5rem" }, lineHeight: 1.02, mb: 4 }}>{faq.title}</Typography>
          <Box>
            {faqItems.map((item, index) => (
              <Accordion key={`${item.question}-${index}`} expanded={expandedFaq === index} onChange={() => setExpandedFaq(expandedFaq === index ? -1 : index)} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderTop: "1px solid #d7e3d8", "&:last-child": { borderBottom: "1px solid #d7e3d8" }, "&::before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ChevronRightIcon />} aria-controls={`faq-panel-${index}`} id={`faq-header-${index}`} sx={{ px: 0, py: 1.2, minHeight: 64, "& .MuiAccordionSummary-content": { my: 0 } }}>
                  <Typography component="h3" sx={{ fontWeight: 750 }}>{item.question}</Typography>
                </AccordionSummary>
                <AccordionDetails id={`faq-panel-${index}`} sx={{ px: 0, pt: 0, pb: 2.5 }}>
                  <Typography sx={{ color: "#5b6d62", lineHeight: 1.8, maxWidth: 760 }}>{item.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="final-cta-title" sx={{ bgcolor: "#dcebe0", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 7 }, textAlign: "center", position: "relative", mb: { xs: 5, md: 8 } }}>
          <EditButton onClick={onEdit.finalCta} editable={editable} />
          <Label>{finalCta.eyebrow}</Label>
          <Typography id="final-cta-title" component="h2" sx={{ fontWeight: 850, letterSpacing: "-0.05em", fontSize: { xs: "2.7rem", md: "4.4rem" }, lineHeight: 0.98, mb: 2 }}>{finalCta.title}</Typography>
          <Typography sx={{ color: "#52645a", lineHeight: 1.8, maxWidth: 560, mx: "auto", mb: 3 }}>{finalCta.copy}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent="center" alignItems="stretch">
            <ActionButton href={finalCta.primaryUrl}>{finalCta.primaryCta}</ActionButton>
            <ActionButton href={finalCta.secondaryUrl} variant="outlined">{finalCta.secondaryCta}</ActionButton>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
