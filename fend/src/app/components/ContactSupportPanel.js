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

export default function ContactSupportPanel({ support }) {
  const content = support || {};

  return (
    <Box component="section" aria-labelledby="contact-support-title" sx={{ bgcolor: "#0e2b20", color: "white", borderRadius: { xs: 3, md: 5 }, p: { xs: 3, md: 6 }, mt: { xs: 6, md: 9 }, mb: { xs: 2, md: 4 } }}>
      <Grid container spacing={{ xs: 4, md: 6 }}>
        <Grid item xs={12} md={5}>
          <Typography variant="overline" sx={{ color: "#a8d8b8", letterSpacing: "0.14em", fontWeight: 800, display: "block", mb: 1 }}>{content.eyebrow || "PERSONAL SUPPORT"}</Typography>
          <Typography id="contact-support-title" component="h2" sx={{ fontWeight: 850, letterSpacing: "-0.05em", fontSize: { xs: "2.7rem", md: "4.2rem" }, lineHeight: 0.98, mb: 2 }}>{content.title || "Contact Weluxo"}</Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.76)", lineHeight: 1.8, mb: 3 }}>{content.copy}</Typography>
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <ContactMailOutlinedIcon sx={{ color: "#a8d8b8", mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{content.email}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.62)", fontSize: 13 }}>{content.emailNote}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              <Box sx={{ p: 2, border: "1px solid rgba(255,255,255,0.16)", borderRadius: 2.5, height: "100%" }}>
                <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{content.liveChatTitle || "Live Chat"}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>{content.liveChatCopy}</Typography>
                <HelpChatWidget floating={false} triggerLabel={content.liveChatButton || "Chat with Weluxo AI"} />
              </Box>
              <Box sx={{ p: 2, border: "1px solid rgba(255,255,255,0.16)", borderRadius: 2.5, height: "100%" }}>
                <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{content.telegramTitle || "Telegram Support"}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>{content.telegramCopy}</Typography>
                <Button component={Link} href={content.telegramUrl || "#"} target="_blank" rel="noreferrer" variant="outlined" startIcon={<SendOutlinedIcon />} sx={{ color: "white", borderColor: "rgba(255,255,255,0.35)", borderRadius: 999, textTransform: "none" }}>{content.telegramButton || "Open Telegram"}</Button>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5, p: 2, border: "1px solid rgba(168,216,184,0.35)", bgcolor: "rgba(168,216,184,0.08)", borderRadius: 2.5 }}>
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>My support tickets</Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: 14, lineHeight: 1.6, mb: 1.5 }}>View your open requests, replies, and support history in the customer dashboard.</Typography>
              <Button component={Link} href="/account/support" variant="contained" startIcon={<ContactMailOutlinedIcon />} sx={{ bgcolor: "#cbe8d2", color: "#12372a", borderRadius: 999, textTransform: "none", fontWeight: 800, "&:hover": { bgcolor: "#e4f3e7" } }}>Open my tickets</Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
