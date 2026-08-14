"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AccessTimeOutlined,
  ArrowForwardRounded,
  CheckCircleOutlineRounded,
  MailOutlineRounded,
  NorthEastRounded,
  SupportAgentOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import defaultHelpContent from "../../../data/help-center.json";
import ContactSupportPanel from "../components/ContactSupportPanel";

const topics = [
  "Order support",
  "Shipping and delivery",
  "Returns and refunds",
  "Product question",
  "Payment support",
  "Partnership",
  "Something else",
];

const initialForm = {
  name: "",
  email: "",
  orderNumber: "",
  topic: "Order support",
  subject: "",
  message: "",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",
    backgroundColor: "rgba(255,255,255,0.86)",
    color: "#17352a",
    transition: "box-shadow 180ms ease, border-color 180ms ease",
    "& fieldset": { borderColor: "#d9e2da" },
    "&:hover fieldset": { borderColor: "#8aa995" },
    "&.Mui-focused": {
      boxShadow: "0 0 0 4px rgba(18,55,42,0.09)",
    },
    "&.Mui-focused fieldset": { borderColor: "#12372a" },
  },
  "& .MuiInputLabel-root": { color: "#6b7d72" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#12372a" },
};

function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.user) return;
        setForm((current) => ({
          ...current,
          name: current.name || data.user.username || data.user.name || "",
          email: current.email || data.user.email || "",
        }));
      })
      .catch(() => {});
  }, []);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
    setSuccess("");
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Please complete your name, email, subject, and message.");
      return;
    }

    setSaving(true);
    try {
      const body = new FormData();
      body.append("customerName", form.name.trim());
      body.append("email", form.email.trim());
      body.append("orderNumber", form.orderNumber.trim());
      body.append("category", form.topic);
      body.append("priority", "Normal");
      body.append("subject", form.subject.trim());
      body.append("contentHtml", form.message.trim());
      body.append("contentText", form.message.trim());

      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to send your message");

      setSuccess(`Thanks — your request ${data.ticket?.ticketNumber ? `(${data.ticket.ticketNumber}) ` : ""}has been received. We will be in touch soon.`);
      setForm((current) => ({ ...initialForm, name: current.name, email: current.email }));
    } catch (submitError) {
      setError(submitError.message || "Unable to send your message");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box component="main" sx={{ bgcolor: "#f5f2eb", color: "#12372a", minHeight: "100vh", overflow: "hidden" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box
          component="section"
          aria-labelledby="contact-hero-title"
          sx={{
            position: "relative",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.12fr 0.88fr" },
            gap: { xs: 4, md: 7 },
            alignItems: "center",
            px: { xs: 3, sm: 5, md: 8 },
            py: { xs: 5, md: 8 },
            minHeight: { md: 500 },
            borderRadius: { xs: 4, md: 6 },
            color: "#fff",
            background: "linear-gradient(130deg, #0b2118 0%, #12372a 56%, #1e4b39 100%)",
            boxShadow: "0 28px 80px rgba(18,55,42,0.18)",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 560,
              height: 560,
              right: -220,
              top: -270,
              borderRadius: "50%",
              border: "1px solid rgba(218,190,121,0.28)",
              boxShadow: "0 0 0 34px rgba(218,190,121,0.035), 0 0 0 70px rgba(218,190,121,0.025)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              width: 220,
              height: 220,
              left: -110,
              bottom: -130,
              borderRadius: "50%",
              background: "rgba(160,207,177,0.12)",
              filter: "blur(4px)",
            },
          }}
        >
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Chip
              label="WELUXO CONCIERGE"
              size="small"
              sx={{
                mb: 2.5,
                color: "#e1c98c",
                backgroundColor: "rgba(225,201,140,0.12)",
                border: "1px solid rgba(225,201,140,0.3)",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.16em",
              }}
            />
            <Typography
              id="contact-hero-title"
              component="h1"
              sx={{
                maxWidth: 650,
                fontSize: { xs: "3.1rem", sm: "4.2rem", md: "5.35rem" },
                lineHeight: 0.94,
                letterSpacing: "-0.065em",
                fontWeight: 850,
              }}
            >
              A clear path to your next answer.
            </Typography>
            <Typography sx={{ maxWidth: 550, mt: 3, color: "rgba(255,255,255,0.72)", lineHeight: 1.75, fontSize: { xs: 15, md: 17 } }}>
              Whether you are checking an order, choosing the right product, or planning what comes next, our team is here to make the experience feel effortless.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 4 }}>
              <Button component={Link} href="#contact-form" variant="contained" endIcon={<ArrowForwardRounded />} sx={{ alignSelf: "flex-start", borderRadius: 999, px: 2.5, py: 1.2, textTransform: "none", fontWeight: 800, color: "#12372a", bgcolor: "#e1c98c", "&:hover": { bgcolor: "#eddca9" } }}>
                Start a conversation
              </Button>
              <Button component={Link} href="/help-center" variant="text" endIcon={<NorthEastRounded />} sx={{ alignSelf: "flex-start", color: "#d9ebdd", textTransform: "none", fontWeight: 750, py: 1.2 }}>
                Visit Help
              </Button>
            </Stack>
          </Box>

          <Paper
            elevation={0}
            sx={{
              position: "relative",
              zIndex: 1,
              p: { xs: 2.5, md: 3.5 },
              minHeight: { md: 310 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "#17352a",
              bgcolor: "rgba(249,247,240,0.96)",
              border: "1px solid rgba(255,255,255,0.62)",
              borderRadius: 3.5,
              boxShadow: "0 22px 55px rgba(3,20,13,0.2)",
            }}
          >
            <Box>
              <Typography sx={{ color: "#678071", fontSize: 11, fontWeight: 850, letterSpacing: "0.16em" }}>THE WELUXO STANDARD</Typography>
              <Typography component="h2" sx={{ mt: 1.5, fontSize: { xs: "1.8rem", md: "2.25rem" }, fontWeight: 820, letterSpacing: "-0.045em", lineHeight: 1.05 }}>
                Thoughtful support, without the runaround.
              </Typography>
            </Box>
            <Box>
              <Divider sx={{ my: 3, borderColor: "#d9e2da" }} />
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "50%", bgcolor: "#e7efe8", color: "#3e785e" }}><AccessTimeOutlined fontSize="small" /></Box>
                  <Box><Typography sx={{ fontWeight: 800, fontSize: 14 }}>Usually within 24–48 hours</Typography><Typography sx={{ color: "#6b7d72", fontSize: 12 }}>A real person will read your message.</Typography></Box>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "50%", bgcolor: "#f1ead8", color: "#9a7737" }}><MailOutlineRounded fontSize="small" /></Box>
                  <Box><Typography sx={{ fontWeight: 800, fontSize: 14 }}>support@weluxo.com</Typography><Typography sx={{ color: "#6b7d72", fontSize: 12 }}>For direct support by email.</Typography></Box>
                </Stack>
              </Stack>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.7fr 1.3fr" }, gap: { xs: 4, md: 8 }, alignItems: "start", mt: { xs: 6, md: 10 } }}>
          <Box component="aside" sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
            <Typography sx={{ color: "#3e785e", fontWeight: 850, fontSize: 11, letterSpacing: "0.16em" }}>HOW CAN WE HELP?</Typography>
            <Typography component="h2" sx={{ mt: 1.5, fontSize: { xs: "2.25rem", md: "3.2rem" }, lineHeight: 0.98, letterSpacing: "-0.055em", fontWeight: 850 }}>
              Send the details. We’ll take it from here.
            </Typography>
            <Typography sx={{ mt: 2.5, color: "#617269", lineHeight: 1.75, maxWidth: 390 }}>
              A little context helps us give you a precise answer faster. Add your order number if your message is about a recent purchase.
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 4 }}>
              {[
                [<SupportAgentOutlined key="support" />, "Personal support", "Guidance from the Weluxo team."],
                [<CheckCircleOutlineRounded key="clear" />, "Clear next steps", "We will tell you exactly what happens next."],
              ].map(([icon, title, copy]) => (
                <Stack key={title} direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.46)" }}>
                  <Box sx={{ color: "#3e785e", mt: 0.2 }}>{icon}</Box>
                  <Box><Typography sx={{ fontWeight: 820, fontSize: 14 }}>{title}</Typography><Typography sx={{ color: "#6b7d72", fontSize: 13, mt: 0.25 }}>{copy}</Typography></Box>
                </Stack>
              ))}
            </Stack>
            <Button component={Link} href="/tracking" endIcon={<NorthEastRounded />} sx={{ mt: 2, px: 0, color: "#12372a", textTransform: "none", fontWeight: 800 }}>
              Looking for an order update?
            </Button>
          </Box>

          <Paper id="contact-form" component="form" onSubmit={submit} elevation={0} sx={{ p: { xs: 2.5, sm: 4, md: 5 }, borderRadius: { xs: 3, md: 4 }, bgcolor: "rgba(255,255,255,0.78)", border: "1px solid #dbe5dc", boxShadow: "0 18px 55px rgba(46,70,55,0.08)" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3.5 }}>
              <Box>
                <Typography sx={{ color: "#3e785e", fontWeight: 850, fontSize: 11, letterSpacing: "0.16em" }}>CONTACT US</Typography>
                <Typography component="h2" sx={{ mt: 1, fontWeight: 850, fontSize: { xs: "2rem", md: "2.65rem" }, letterSpacing: "-0.05em", lineHeight: 1 }}>Tell us what you need.</Typography>
              </Box>
              <Typography sx={{ color: "#718078", fontSize: 13, maxWidth: 185, lineHeight: 1.55 }}>Fields marked with * are required.</Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField required fullWidth label="Full name" value={form.name} onChange={update("name")} autoComplete="name" sx={fieldSx} />
              <TextField required fullWidth type="email" label="Email address" value={form.email} onChange={update("email")} autoComplete="email" sx={fieldSx} />
              <TextField fullWidth label="Order number" value={form.orderNumber} onChange={update("orderNumber")} placeholder="Optional" sx={fieldSx} />
              <TextField select fullWidth label="What can we help with?" value={form.topic} onChange={update("topic")} sx={fieldSx}>
                {topics.map((topic) => <MenuItem key={topic} value={topic}>{topic}</MenuItem>)}
              </TextField>
              <TextField required fullWidth label="Subject" value={form.subject} onChange={update("subject")} sx={{ ...fieldSx, gridColumn: { xs: "auto", sm: "1 / -1" } }} />
              <TextField required fullWidth multiline minRows={6} label="Your message" value={form.message} onChange={update("message")} placeholder="Share a few details so we can help you well." sx={{ ...fieldSx, gridColumn: { xs: "auto", sm: "1 / -1" } }} />
            </Box>
            {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>{success}</Alert>}
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={2} sx={{ mt: 3 }}>
              <Typography sx={{ color: "#718078", fontSize: 12, lineHeight: 1.5 }}>By sending this form, you agree to let Weluxo use your details to respond to your request.</Typography>
              <Button type="submit" disabled={saving} variant="contained" endIcon={<ArrowForwardRounded />} sx={{ flexShrink: 0, borderRadius: 999, px: 2.5, py: 1.2, bgcolor: "#12372a", textTransform: "none", fontWeight: 800, "&:hover": { bgcolor: "#1d503c" } }}>
                {saving ? "Sending…" : "Send message"}
              </Button>
            </Stack>
          </Paper>
        </Box>

        <ContactSupportPanel support={defaultHelpContent.contactSupport} />

        <Box sx={{ mt: { xs: 6, md: 9 }, mb: { xs: 2, md: 4 }, p: { xs: 2.5, md: 3 }, display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, gap: 2, borderTop: "1px solid #d8e1d8" }}>
          <Box><Typography sx={{ fontWeight: 820 }}>Prefer to find the answer yourself?</Typography><Typography sx={{ color: "#718078", fontSize: 13, mt: 0.5 }}>Browse shipping, returns, product, and account guidance.</Typography></Box>
          <Button component={Link} href="/help-center" endIcon={<ArrowForwardRounded />} sx={{ color: "#12372a", textTransform: "none", fontWeight: 800, px: 0 }}>Open Help</Button>
        </Box>
      </Container>
    </Box>
  );
}

export default ContactPage;
