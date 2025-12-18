"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Grid,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

const FALLBACK = {
  hero: {
    title: "About Us",
    subtitle: "We craft digital experiences that connect brands with people.",
    ctaText: "Contact Us",
    ctaUrl: "/contact",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    alt: "Team collaborating",
  },
  mission: "Empower businesses with simple, pragmatic technology.",
  values: "Honesty, craftsmanship, and partnership guide everything we do.",
  team: [],
  story: [],
  approach: [
    { title: "Listen first", copy: "We start with the people who use the product, not the feature list." },
    { title: "Prototype quickly", copy: "Lightweight experiments help us validate before you invest heavily." },
    { title: "Ship with confidence", copy: "Tight feedback loops, observability, and documentation keep releases calm." },
  ],
  contactCta: {
    title: "Ready to build the next release together?",
    copy: "Tell us about your team, your users, and what great looks like. We will respond within one business day.",
    buttonText: "Start a conversation",
    buttonUrl: "/contact",
  },
};

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
      .catch(() => setContent(FALLBACK));
  }, [initialContent]);

  const data = content || FALLBACK;
  const hero = data.hero || FALLBACK.hero;
  const team = Array.isArray(data.team) ? data.team : [];
  const story = Array.isArray(data.story) ? data.story : [];
  const approach = Array.isArray(data.approach) && data.approach.length ? data.approach : FALLBACK.approach;
  const contactCta = data.contactCta || FALLBACK.contactCta;
  const stats = [
    { label: "Projects Delivered", value: "120+" },
    { label: "Avg. Response Time", value: "<1 hr" },
    { label: "Countries Served", value: "18" },
  ];

  const renderEdit = (key) =>
    onEdit[key] ? (
      <IconButton
        size="small"
        onClick={onEdit[key]}
        sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,0.4)", color: "white" }}
      >
        <EditIcon fontSize="small" />
      </IconButton>
    ) : null;

  return (
    <Box sx={{ fontFamily: "'Space Grotesk','Segoe UI',sans-serif", bgcolor: "#050815", color: "white" }}>
      <Box sx={{ position: "relative", overflow: "hidden", pb: { xs: 8, md: 10 } }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.18), transparent 35%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.2), transparent 40%), linear-gradient(120deg, #0b1324 0%, #0d1f3d 60%, #0a1021 100%)",
          }}
        />
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, pt: { xs: 6, md: 9 } }}>
          {renderEdit("hero")}
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.5, py: 0.5, bgcolor: "rgba(255,255,255,0.08)", borderRadius: 999, mb: 2 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#22c55e" }} />
                <Typography variant="caption" sx={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Built with teams, not templates
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={800} gutterBottom>
                {hero.title}
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 640, mb: 3 }}>
                {hero.subtitle}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  href={hero.ctaUrl || "#"}
                  variant="contained"
                  sx={{ borderRadius: 2, textTransform: "none", px: 3, py: 1.2 }}
                >
                  {hero.ctaText || "Talk to us"}
                </Button>
                <Button
                  href="#story"
                  variant="outlined"
                  sx={{ borderRadius: 2, textTransform: "none", borderColor: "rgba(255,255,255,0.35)", color: "white", px: 3, py: 1.2 }}
                >
                  Our journey
                </Button>
              </Stack>
              <Grid container spacing={2} sx={{ mt: 4 }}>
                {stats.map((stat) => (
                  <Grid item xs={4} key={stat.label}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <Typography variant="h5" fontWeight={800}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.75 }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  background: "linear-gradient(160deg, rgba(37,99,235,0.25), rgba(12,17,34,0.9))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                  position: "relative",
                }}
              >
                <CardMedia
                  component="img"
                  image={hero.image}
                  alt={hero.alt || "Team"}
                  sx={{ height: { xs: 260, md: 360 }, objectFit: "cover", opacity: 0.95 }}
                />
                <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, bgcolor: "rgba(5,8,21,0.75)", backdropFilter: "blur(6px)" }}>
                  <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)" }}>
                    Pragmatic problem solvers with a bias for shipping.
                  </Typography>
                  <Box sx={{ minWidth: 80, textAlign: "right" }}>
                    <Typography variant="h6" fontWeight={800}>
                      4.9/5
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      client rating
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.08)",
                bgcolor: "rgba(255,255,255,0.02)",
                backdropFilter: "blur(6px)",
                position: "relative",
              }}
            >
              {renderEdit("mission")}
              <Typography variant="overline" sx={{ color: "#60a5fa", letterSpacing: 1 }}>
                Purpose
              </Typography>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Our Mission
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.75)" }}>{data.mission}</Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.08)",
                bgcolor: "rgba(255,255,255,0.02)",
                backdropFilter: "blur(6px)",
                position: "relative",
              }}
            >
              {renderEdit("values")}
              <Typography variant="overline" sx={{ color: "#60a5fa", letterSpacing: 1 }}>
                Compass
              </Typography>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Our Values
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.75)" }}>{data.values}</Typography>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, position: "relative" }}>
            <Typography variant="h5" fontWeight={800}>
              How we work
            </Typography>
            {renderEdit("approach")}
          </Box>
          <Grid container spacing={3}>
            {approach.map((item, idx) => (
              <Grid item xs={12} md={4} key={item.title}>
                <Card
                  sx={{
                    p: 3,
                    height: "100%",
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.06)",
                    bgcolor: "rgba(12,18,36,0.9)",
                  }}
                >
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 1 }}>
                    Step {idx + 1}
                  </Typography>
                  <Typography variant="h6" fontWeight={800} gutterBottom>
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.72)" }}>{item.copy}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>

      <Box sx={{ backgroundColor: "#0b1220", py: 8 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, position: "relative" }}>
            <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom>
              Meet the Team
            </Typography>
            <Box sx={{ position: "absolute", right: { xs: 0, md: 24 }, top: 6 }}>
              {renderEdit("team")}
            </Box>
          </Box>

          <Grid container spacing={4} justifyContent="center" sx={{ mt: 2 }}>
            {(team.length ? team : FALLBACK.team).map((member, i) => (
              <Grid item xs={12} md={6} key={member.name || i}>
                <Card
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.1)",
                    bgcolor: "rgba(255,255,255,0.02)",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  <CardMedia
                    component="img"
                    image={member.img}
                    alt={member.name}
                    sx={{ width: 140, height: 140, borderRadius: 2, objectFit: "cover" }}
                  />
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={800}>
                      {member.name}
                    </Typography>
                    <Typography variant="body2" color="grey.300" sx={{ mb: 1 }}>
                      {member.role}
                    </Typography>
                    <Typography variant="body2" color="grey.300">
                      {member.bio}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box id="story" sx={{ backgroundColor: "#0d1324", color: "white", py: 9, position: "relative" }}>
        {renderEdit("story")}
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <Typography variant="overline" sx={{ color: "#60a5fa", letterSpacing: 1 }}>
                Our Story
              </Typography>
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Built for people who expect better.
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.75)" }}>
                We keep the process transparent, the teams small, and the outcomes measurable. Here is how we got here.
              </Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={3}>
                {(story.length ? story : FALLBACK.story).map((p, idx) => (
                  <Card
                    key={idx}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: "1px solid rgba(255,255,255,0.08)",
                      bgcolor: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <Typography variant="body2" sx={{ color: "#60a5fa", mb: 1 }}>
                      Chapter {idx + 1}
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.82)" }}>{p}</Typography>
                  </Card>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 6, bgcolor: "#0a0f1c", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <Container maxWidth="lg">
          <Card
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(120deg, rgba(37,99,235,0.3), rgba(6,182,212,0.25))",
              color: "white",
              textAlign: "center",
            }}
          >
            <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                {contactCta.title}
              </Typography>
              <Box sx={{ position: "absolute", right: -12, top: -8 }}>{renderEdit("contactCta")}</Box>
            </Box>
            <Typography sx={{ color: "rgba(255,255,255,0.8)", mb: 2 }}>
              {contactCta.copy}
            </Typography>
            <Button
              href={contactCta.buttonUrl || "/contact"}
              variant="contained"
              sx={{ borderRadius: 2, textTransform: "none", px: 3, py: 1.2 }}
            >
              {contactCta.buttonText || "Get in touch"}
            </Button>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}
