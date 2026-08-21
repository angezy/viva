"use client";

import Link from "next/link";
import { Box, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CancelIcon from "@mui/icons-material/Cancel";

const icons = {
  success: <CheckCircleIcon sx={{ fontSize: 56, color: "success.light" }} />,
  failed: <ErrorOutlineIcon sx={{ fontSize: 56, color: "error.light" }} />,
  cancelled: <CancelIcon sx={{ fontSize: 56, color: "warning.light" }} />,
};

export default function OrderOutcomeLayout({ type, eyebrow, title, description, orderId, children, actions }) {
  return (
    <Box sx={{ minHeight: "100vh", background: "var(--color-background)", color: "var(--color-text-primary)", py: 7 }}>
      <Container maxWidth="md">
        <Link href="/checkout" style={{ color: "var(--color-text-primary)", textDecoration: "none" }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 4 }}>Weluxo</Typography>
        </Link>
        <Card sx={{ bgcolor: "#ffffff", color: "var(--color-text-primary)", border: `1px solid ${type === "success" ? "rgba(21,128,61,0.3)" : type === "failed" ? "rgba(185,28,28,0.3)" : "rgba(242,140,40,0.35)"}`, borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack alignItems="center" textAlign="center" spacing={1.5}>
              {icons[type]}
              <Typography variant="overline" sx={{ letterSpacing: 3, color: type === "success" ? "success.light" : type === "failed" ? "error.light" : "warning.light" }}>{eyebrow}</Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, fontSize: { xs: "2.2rem", md: "3.3rem" }, lineHeight: 1.1 }}>{title}</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", maxWidth: 620 }}>{description}</Typography>
              {orderId && <Typography sx={{ mt: 1, fontWeight: 800 }}>Reference: #{orderId}</Typography>}
            </Stack>
            <Box sx={{ mt: 4 }}>{children}</Box>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="center" spacing={1.5} sx={{ mt: 4 }}>
              {actions}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export function OutcomeButton({ href, children, variant = "contained" }) {
  return <Button component={Link} href={href} variant={variant} sx={{ borderRadius: 999, color: variant === "outlined" ? "var(--color-primary)" : undefined, borderColor: variant === "outlined" ? "var(--color-primary)" : undefined }}>{children}</Button>;
}
