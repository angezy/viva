import HelpChatWidget from "../components/HelpChatWidget";
import { Box, Container, Typography } from "@mui/material";

export default function ChatPage() {
  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "var(--color-background)", color: "var(--color-text-primary)", py: { xs: 5, md: 9 } }}>
      <Container maxWidth="sm">
        <Typography sx={{ color: "var(--color-primary)", fontWeight: 850, fontSize: 11, letterSpacing: "0.16em" }}>WELUXO AI CONCIERGE</Typography>
        <Typography component="h1" sx={{ mt: 1, fontWeight: 850, fontSize: { xs: "2.8rem", md: "4rem" }, letterSpacing: "-0.06em", lineHeight: 0.98 }}>How can we help?</Typography>
        <Typography sx={{ mt: 2, mb: 4, color: "var(--color-text-secondary)", lineHeight: 1.7 }}>Ask about orders, delivery, returns, payments, products, or account access.</Typography>
        <Box sx={{ position: "relative", minHeight: 440, display: "flex", alignItems: "flex-start" }}><HelpChatWidget initialOpen floating={false} /></Box>
      </Container>
    </Box>
  );
}
