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
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditIcon from "@mui/icons-material/Edit";
import defaultPrivacy from "../../../data/privacy-policy.json";

function EditButton({ onClick, editable }) {
  if (!editable || !onClick) return null;
  return (
    <IconButton
      size="small"
      aria-label="Edit section"
      onClick={onClick}
      sx={{ position: "absolute", top: 12, right: 12, zIndex: 2, color: "var(--color-primary)", bgcolor: "#ffffff", "&:hover": { bgcolor: "var(--color-surface-muted)" } }}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  );
}

function Paragraphs({ text }) {
  return String(text || "")
    .split("\n\n")
    .filter(Boolean)
    .map((paragraph, index) => (
      <Typography key={index} sx={{ color: "var(--color-text-secondary)", lineHeight: 1.85, mb: 2 }}>
        {paragraph}
      </Typography>
    ));
}

function LegalTable({ table }) {
  if (!table?.headers?.length || !table?.rows?.length) return null;
  return (
    <Box sx={{ overflowX: "auto", mt: 2, mb: 2 }}>
      <Box component="table" sx={{ width: "100%", minWidth: 620, borderCollapse: "collapse", bgcolor: "#ffffff", border: "1px solid var(--color-border)" }}>
        <Box component="thead">
          <Box component="tr" sx={{ bgcolor: "var(--color-accent-soft)" }}>
            {table.headers.map((header) => <Box component="th" scope="col" key={header} sx={{ textAlign: "left", p: 1.5, color: "var(--color-text-primary)", fontSize: 13, fontWeight: 800, borderBottom: "1px solid var(--color-border)" }}>{header}</Box>)}
          </Box>
        </Box>
        <Box component="tbody">
          {table.rows.map((row, rowIndex) => (
            <Box component="tr" key={rowIndex}>
              {row.map((cell, cellIndex) => <Box component="td" key={`${rowIndex}-${cellIndex}`} sx={{ p: 1.5, color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.5, borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>{cell}</Box>)}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default function LegalPageSection({ pageSlug, initialContent = null, onEdit = {}, editable = false }) {
  const [content, setContent] = useState(initialContent || defaultPrivacy);
  const [expandedFaq, setExpandedFaq] = useState(0);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }
    let mounted = true;
    fetch(`/api/dashboard/legal/${pageSlug}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setContent(defaultPrivacy));
    return () => {
      mounted = false;
    };
  }, [initialContent, pageSlug]);

  const data = content || defaultPrivacy;
  const hero = data.hero || {};
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const faq = data.faq || {};
  const faqItems = Array.isArray(faq.items) ? faq.items : [];

  return (
    <Box component="main" sx={{ bgcolor: "var(--color-background)", color: "var(--color-text-primary)", minHeight: "100vh", fontFamily: "var(--site-font-family, 'Space Grotesk','Segoe UI',sans-serif)" }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 8 } }}>
        <Box component="header" sx={{ position: "relative", bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: { xs: 3, md: 4 }, p: { xs: 3, md: 6 }, mb: { xs: 5, md: 8 } }}>
          <EditButton onClick={onEdit.hero} editable={editable} />
          <Typography variant="overline" sx={{ color: "var(--color-accent)", fontWeight: 800, letterSpacing: "0.14em" }}>{hero.eyebrow}</Typography>
          <Typography component="h1" sx={{ fontWeight: 850, letterSpacing: "-0.05em", fontSize: { xs: "2.7rem", md: "4.5rem" }, lineHeight: 0.98, mt: 1, mb: 3 }}>{hero.title}</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, fontSize: { xs: "1rem", md: "1.1rem" }, maxWidth: 720 }}>{hero.intro}</Typography>
        </Box>

        <Stack spacing={{ xs: 4, md: 6 }}>
          {sections.map((section, index) => (
            <Box component="section" aria-labelledby={`legal-section-${index}`} key={`${section.title}-${index}`} sx={{ position: "relative", borderBottom: index === sections.length - 1 ? 0 : "1px solid var(--color-border)", pb: index === sections.length - 1 ? 0 : { xs: 3, md: 5 } }}>
              <EditButton onClick={() => onEdit.section?.(index)} editable={editable} />
              <Typography id={`legal-section-${index}`} component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.035em", fontSize: { xs: "1.55rem", md: "2rem" }, mb: 2, pr: 5 }}>{section.title}</Typography>
              <Paragraphs text={section.body} />
              {Array.isArray(section.bullets) && section.bullets.length > 0 && (
                <Box component="ul" sx={{ color: "var(--color-text-secondary)", pl: 3, mb: 2, "& li": { mb: 1.2, lineHeight: 1.7 } }}>
                  {section.bullets.map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>)}
                </Box>
              )}
              {Array.isArray(section.steps) && section.steps.length > 0 && (
                <Box component="ol" sx={{ color: "var(--color-text-secondary)", pl: 3, mb: 2, "& li": { mb: 1.2, lineHeight: 1.7, pl: 0.5 } }}>
                  {section.steps.map((step, stepIndex) => <li key={`${step}-${stepIndex}`}>{step}</li>)}
                </Box>
              )}
              <LegalTable table={section.table} />
            </Box>
          ))}
        </Stack>

        {(faqItems.length > 0 || (editable && onEdit.faq)) && (
          <Box component="section" aria-labelledby="legal-faq-title" sx={{ mt: { xs: 8, md: 11 }, position: "relative" }}>
            <EditButton onClick={onEdit.faq} editable={editable} />
            <Typography variant="overline" sx={{ color: "#3e785e", fontWeight: 800, letterSpacing: "0.14em" }}>QUESTIONS, ANSWERED</Typography>
            <Typography id="legal-faq-title" component="h2" sx={{ fontWeight: 820, letterSpacing: "-0.04em", fontSize: { xs: "2rem", md: "3rem" }, lineHeight: 1.05, mt: 1, mb: 4 }}>{faq.title}</Typography>
            {faqItems.length === 0 && <Typography sx={{ color: "var(--color-text-secondary)", py: 2 }}>No questions have been added yet.</Typography>}
            {faqItems.map((item, index) => (
              <Accordion key={`${item.question}-${index}`} expanded={expandedFaq === index} onChange={() => setExpandedFaq(expandedFaq === index ? -1 : index)} disableGutters elevation={0} sx={{ bgcolor: "transparent", borderTop: "1px solid var(--color-border)", "&:last-child": { borderBottom: "1px solid var(--color-border)" }, "&::before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ChevronRightIcon />} aria-controls={`legal-faq-panel-${index}`} id={`legal-faq-header-${index}`} sx={{ px: 0, py: 1, minHeight: 64, "& .MuiAccordionSummary-content": { my: 0 } }}>
                  <Typography component="h3" sx={{ fontWeight: 750 }}>{item.question}</Typography>
                </AccordionSummary>
                <AccordionDetails id={`legal-faq-panel-${index}`} sx={{ px: 0, pt: 0, pb: 2.5 }}>
                  <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>{item.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        <Box sx={{ mt: { xs: 7, md: 10 }, p: { xs: 3, md: 4 }, bgcolor: "var(--color-primary-soft)", borderRadius: 3 }}>
          <Typography component="h2" sx={{ fontWeight: 800, mb: 1 }}>Need help with an order?</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7, mb: 2 }}>Contact Weluxo support if you need help understanding a policy or resolving an order question.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Button component={Link} href="/contact" variant="contained" endIcon={<ArrowForwardIcon />} sx={{ bgcolor: "var(--color-primary)", borderRadius: 999, textTransform: "none", fontWeight: 800 }}>Contact Support</Button>
            <Button component={Link} href="/shop" variant="outlined" endIcon={<ArrowForwardIcon />} sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999, textTransform: "none", fontWeight: 800 }}>Continue Shopping</Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
