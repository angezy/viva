"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

export default function AboutSection({ initialContent = null, onEdit = {} }) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }
    fetch("/api/dashboard/about")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setContent(data))
      .catch(() => setContent({}));
  }, [initialContent]);

  const renderEdit = (key) =>
    onEdit[key] ? (
      <IconButton
        size="small"
        onClick={onEdit[key]}
        sx={{ position: "absolute", top: 0, right: 0, bgcolor: "rgba(0,0,0,0.4)", color: "white" }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    ) : null;

  const toStr = (val) => {
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
      return val.map((item) => (typeof item === "string" ? item : item?.title || item?.copy || item?.name || "")).join("\n\n");
    }
    return "";
  };
  const data = content || {};
  const hero = data.hero || {};
  const heroTitle = hero.title || "About Weluxo";
  const heroSubtitle = hero.subtitle || "Smart Products. Better Living.";
  const missionText = toStr(data.mission);
  const valuesText = toStr(data.values);
  const approachText = toStr(data.approach);
  const teamText = toStr(data.team);
  const storyText = toStr(data.story);
  const cta = data.contactCta || {};
  const footerTitle = cta.title || "Weluxo";
  const footerSubtitle = cta.copy || "Smart Living. Better Choices.";

  return (
    <Box sx={{ fontFamily: "'Space Grotesk','Segoe UI',sans-serif", bgcolor: "#050815", color: "white", minHeight: "100vh" }}>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        {/* Header / Hero */}
        <Box sx={{ textAlign: "center", mb: 6, position: "relative" }}>
          {renderEdit("hero")}
          <Typography
            variant="overline"
            sx={{ color: "#60a5fa", letterSpacing: 2, fontSize: "0.8rem", mb: 1, display: "block" }}
          >
            About Us
          </Typography>
          <Typography variant="h3" fontWeight={800} gutterBottom>
            {heroTitle}
          </Typography>
          <Typography variant="h5" fontWeight={600} sx={{ color: "#93c5fd" }}>
            {heroSubtitle}
          </Typography>
        </Box>

        {/* Section 1: About Weluxo (mission) */}
        {missionText && (
          <Box sx={{ mb: 5, position: "relative" }}>
            {renderEdit("mission")}
            {missionText.split("\n\n").map((paragraph, i) => (
              <Typography key={i} variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.8, mb: 2 }}>
                {paragraph}
              </Typography>
            ))}
          </Box>
        )}

        {/* Section 2: Our Philosophy (values) */}
        {valuesText && (
          <Box sx={{ mb: 5, position: "relative" }}>
            {renderEdit("values")}
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Our Philosophy
            </Typography>
            {valuesText.split("\n\n").map((paragraph, i) => (
              <Typography key={i} variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.8, mb: 2 }}>
                {paragraph}
              </Typography>
            ))}
            <Box sx={{ pl: 3, mt: 1 }}>
              <Typography variant="body1" sx={{ color: "#93c5fd", lineHeight: 2 }}>
                {"\u2022"} Quality over quantity.
              </Typography>
              <Typography variant="body1" sx={{ color: "#93c5fd", lineHeight: 2 }}>
                {"\u2022"} Function over gimmicks.
              </Typography>
              <Typography variant="body1" sx={{ color: "#93c5fd", lineHeight: 2 }}>
                {"\u2022"} Customer experience above everything else.
              </Typography>
            </Box>
          </Box>
        )}

        {/* Section 3: Our Commitment (approach) */}
        {approachText && (
          <Box sx={{ mb: 5, position: "relative" }}>
            {renderEdit("approach")}
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Our Commitment
            </Typography>
            {approachText.split("\n\n").map((paragraph, i) => (
              <Typography key={i} variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.8, mb: 2 }}>
                {paragraph}
              </Typography>
            ))}
          </Box>
        )}

        {/* Section 4: Why Customers Choose Weluxo (team) */}
        {teamText && (
          <Box sx={{ mb: 5, position: "relative" }}>
            {renderEdit("team")}
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Why Customers Choose Weluxo
            </Typography>
            {teamText.split("\n\n").map((paragraph, i) => (
              <Typography key={i} variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.8, mb: 2 }}>
                {paragraph}
              </Typography>
            ))}
            <Box sx={{ pl: 3, mt: 1 }}>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} Carefully curated product collections
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} Modern and practical everyday solutions
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} Secure checkout and protected payments
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} Worldwide shipping
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} Responsive customer support
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} Continuous quality improvement
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 2 }}>
                {"\u2022"} A customer-first approach
              </Typography>
            </Box>
          </Box>
        )}

        {/* Section 5: Looking Ahead (story) */}
        {storyText && (
          <Box sx={{ mb: 5, position: "relative" }}>
            {renderEdit("story")}
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Looking Ahead
            </Typography>
            {storyText.split("\n\n").map((paragraph, i) => (
              <Typography key={i} variant="body1" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.8, mb: 2 }}>
                {paragraph}
              </Typography>
            ))}
          </Box>
        )}

        {/* Footer Signature (contactCta) */}
        <Box sx={{ textAlign: "center", mt: 6, position: "relative" }}>
          {renderEdit("contactCta")}
          <Typography variant="h5" fontWeight={700} sx={{ color: "#93c5fd" }}>
            {footerTitle}
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}>
            {footerSubtitle}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}