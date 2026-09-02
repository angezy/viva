"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import HelpChatWidget from "./HelpChatWidget";
import { useSiteSettings } from "./SiteThemeProvider";

export default function ContactSupportPanel({ support }) {
  const content = support || {};
  const siteSettings = useSiteSettings();

  return (
    <Box component="section" aria-labelledby="contact-support-title" sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", boxShadow: "0 14px 40px rgba(43,43,43,0.07)", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 6 }, mt: { xs: 6, md: 9 }, mb: { xs: 2, md: 4 } }}>
      <Grid container spacing={{ xs: 4, md: 6 }}>
        <Grid
          size={{
            xs: 12,
            md: 5
          }}>
          <Typography variant="overline" sx={{ color: "var(--color-accent)", letterSpacing: "0.14em", fontWeight: 800, display: "block", mb: 1 }}>{content.eyebrow || "PERSONAL SUPPORT"}</Typography>
          <Typography id="contact-support-title" component="h2" sx={{ fontWeight: 850, letterSpacing: "-0.05em", fontSize: { xs: "2.7rem", md: "4.2rem" }, lineHeight: 0.98, mb: 2 }}>{content.title || `Contact ${siteSettings.siteName}`}</Typography>
          <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.8, mb: 3 }}>{content.copy}</Typography>
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <ContactMailOutlinedIcon sx={{ color: "var(--color-primary)", mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{content.email || siteSettings.supportEmail}</Typography>
                <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 13 }}>{content.emailNote}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              <Box sx={{ p: 2, border: "1px solid var(--color-border)", bgcolor: "var(--color-surface-muted)", borderRadius: 2.5, height: "100%" }}>
                <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{content.liveChatTitle || "Live Chat"}</Typography>
                <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>{content.liveChatCopy}</Typography>
                <HelpChatWidget floating={false} triggerLabel={content.liveChatButton || `Chat with ${siteSettings.siteName} AI`} />
              </Box>
              <Box sx={{ p: 2, border: "1px solid var(--color-border)", bgcolor: "var(--color-surface-muted)", borderRadius: 2.5, height: "100%" }}>
                <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{content.telegramTitle || "Telegram Support"}</Typography>
                <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>{content.telegramCopy}</Typography>
                <Button component={Link} href={content.telegramUrl || "#"} target="_blank" rel="noreferrer" variant="outlined" startIcon={<SendOutlinedIcon />} sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", borderRadius: 999, textTransform: "none", "&:hover": { borderColor: "var(--color-primary-dark)", bgcolor: "var(--color-primary-soft)" } }}>{content.telegramButton || "Open Telegram"}</Button>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5, p: 2, border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)", bgcolor: "var(--color-primary-soft)", borderRadius: 2.5 }}>
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>My support tickets</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>View your open requests, replies, and support history in the customer dashboard.</Typography>
              <Button component={Link} href="/account/support" variant="contained" startIcon={<ContactMailOutlinedIcon />} sx={{ bgcolor: "var(--color-primary)", color: "#ffffff", borderRadius: 999, textTransform: "none", fontWeight: 800, "&:hover": { bgcolor: "var(--color-primary-dark)" } }}>Open my tickets</Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
