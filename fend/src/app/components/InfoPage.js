import { Box, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";

export default function InfoPage({ eyebrow, title, description, sections = [], actions = true }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "var(--color-background)", color: "var(--color-text-primary)", py: 7 }}>
      <Container maxWidth="md">
        <Card sx={{ borderRadius: 4, border: "1px solid var(--color-border)", boxShadow: "0 18px 50px rgba(43,43,43,0.08)" }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="overline" sx={{ color: "var(--color-primary)", letterSpacing: 3 }}>{eyebrow}</Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: "2.2rem", md: "3.2rem" }, mb: 1 }}>{title}</Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7, mb: 4 }}>{description}</Typography>
            <Stack spacing={3}>
              {sections.map((section) => (
                <Box key={section.title}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{section.title}</Typography>
                  <Typography sx={{ color: "var(--color-text-secondary)", lineHeight: 1.75 }}>{section.body}</Typography>
                </Box>
              ))}
            </Stack>
            {actions && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 5 }}><Button href="/checkout" variant="contained" sx={{ borderRadius: 999 }}>Go to checkout</Button><Button href="/contact" variant="outlined" sx={{ borderRadius: 999 }}>Contact support</Button></Stack>}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
