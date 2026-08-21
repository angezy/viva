"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditIcon from "@mui/icons-material/Edit";
import defaultContent from "../../../data/faq.json";

function EditButton({ onClick, editable }) {
  if (!editable || !onClick) return null;
  return (
    <IconButton
      size="small"
      aria-label="Edit section"
      onClick={onClick}
      sx={{ position: "absolute", top: 12, right: 12, zIndex: 3, color: "var(--color-primary)", bgcolor: "#ffffff", "&:hover": { bgcolor: "var(--color-surface-muted)" } }}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  );
}

function ActionButton({ href, children, variant = "contained" }) {
  return (
    <Button
      component={Link}
      href={href || "/shop"}
      variant={variant}
      endIcon={<ArrowForwardIcon />}
      sx={{ borderRadius: 999, px: 2.5, py: 1.15, textTransform: "none", fontWeight: 800, ...(variant === "contained" ? { bgcolor: "var(--color-primary)", "&:hover": { bgcolor: "var(--color-primary-dark)" } } : { color: "var(--color-primary)", borderColor: "var(--color-primary)" }) }}
    >
      {children}
    </Button>
  );
}

function Label({ children, light = false }) {
  return <Typography variant="overline" sx={{ color: light ? "var(--color-accent)" : "var(--color-primary)", letterSpacing: "0.14em", fontWeight: 800, display: "block", mb: 1 }}>{children}</Typography>;
}

export default function FaqPageSection({ initialContent = null, onEdit = {}, editable = false }) {
  const [content, setContent] = useState(initialContent || defaultContent);
  const [expandedFaq, setExpandedFaq] = useState(0);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }
    let mounted = true;
    fetch("/api/dashboard/faq")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setContent(defaultContent));
    return () => {
      mounted = false;
    };
  }, [initialContent]);

  const data = content || defaultContent;
  const hero = data.hero || defaultContent.hero;
  const faq = data.faq || defaultContent.faq;
  const support = data.support || defaultContent.support;
  const items = Array.isArray(faq.items) ? faq.items : [];

  return (
    <Box component="main" sx={{ bgcolor: "var(--color-background)", color: "var(--color-text-primary)", minHeight: "100vh", fontFamily: "var(--site-font-family, 'Space Grotesk','Segoe UI',sans-serif)" }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
        <Box component="header" sx={{ position: "relative", bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: { xs: 3, md: 5 }, overflow: "hidden", p: { xs: 3, md: 7 }, mb: { xs: 6, md: 10 } }}>
          <Box sx={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", bgcolor: "rgba(168,216,184,0.16)", top: -170, right: -90 }} />
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
            <EditButton onClick={onEdit.hero} editable={editable} />
            <Label light>{hero.eyebrow}</Label>
            <Typography component="h1" sx={{ fontWeight: 850, letterSpacing: "-0.055em", fontSize: { xs: "2.85rem", sm: "3.8rem", md: "5.2rem" }, lineHeight: 0.98, maxWidth: 680 }}>{hero.title}</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, maxWidth: 660, mt: 3, fontSize: { xs: "1rem", md: "1.1rem" } }}>{hero.intro}</Typography>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="faq-page-title" sx={{ maxWidth: 920, mx: "auto", position: "relative", mb: { xs: 8, md: 12 } }}>
          <EditButton onClick={onEdit.faq} editable={editable} />
          <Label>{faq.eyebrow}</Label>
          <Typography id="faq-page-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.045em", fontSize: { xs: "2.25rem", md: "3.6rem" }, lineHeight: 1.02, mb: 4 }}>{faq.title}</Typography>
          {items.length === 0 && <Typography sx={{ color: "var(--color-text-secondary)", py: 3 }}>No questions have been added yet.</Typography>}
          {items.map((item, index) => (
            <Accordion key={`${item.question}-${index}`} expanded={expandedFaq === index} onChange={() => setExpandedFaq(expandedFaq === index ? -1 : index)} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderTop: "1px solid var(--color-border)", "&:last-child": { borderBottom: "1px solid var(--color-border)" }, "&::before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ChevronRightIcon />} aria-controls={`faq-page-panel-${index}`} id={`faq-page-header-${index}`} sx={{ px: 0, py: 1.2, minHeight: 68, "& .MuiAccordionSummary-content": { my: 0 } }}>
                <Typography component="h3" sx={{ fontWeight: 750 }}>{item.question}</Typography>
              </AccordionSummary>
              <AccordionDetails id={`faq-page-panel-${index}`} sx={{ px: 0, pt: 0, pb: 2.5 }}>
                <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, maxWidth: 780 }}>{item.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        <Box component="section" aria-labelledby="faq-support-title" sx={{ position: "relative", bgcolor: "var(--color-primary-soft)", border: "1px solid rgba(37,99,235,0.16)", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 7 }, mb: { xs: 5, md: 8 } }}>
          <EditButton onClick={onEdit.support} editable={editable} />
          <Label>{support.eyebrow}</Label>
          <Typography id="faq-support-title" component="h2" sx={{ fontWeight: 850, letterSpacing: "-0.05em", fontSize: { xs: "2.6rem", md: "4.2rem" }, lineHeight: 0.98, mb: 2 }}>{support.title}</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, maxWidth: 620, mb: 3 }}>{support.copy}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems="stretch">
            <ActionButton href={support.primaryUrl}>{support.primaryCta}</ActionButton>
            <ActionButton href={support.secondaryUrl} variant="outlined">{support.secondaryCta}</ActionButton>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
