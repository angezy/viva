"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowForwardRounded,
  Close,
  LocalOfferOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  Fade,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { fetchSession } from "../lib/apiClient";
import { useSiteSettings } from "./SiteThemeProvider";

const SEEN_KEY = "weluxoWelcomeOfferSeen";

function markOfferSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "true");
  } catch (_error) {
    // The popup still works for this session when storage is unavailable.
  }
}

export default function WelcomeOfferPopup() {
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const showForFirstVisit = async () => {
      try {
        if (window.localStorage.getItem(SEEN_KEY) === "true") return;
      } catch (_error) {
        // Continue with an in-session first-visit experience.
      }

      const [sessionResult] = await Promise.allSettled([fetchSession()]);
      if (!active) return;

      const nextSettings = settings;
      const session = sessionResult.status === "fulfilled" ? sessionResult.value : null;

      if (nextSettings.welcomePopupEnabled === false || session?.user) return;

      markOfferSeen();
      setOpen(true);
    };

    const timer = window.setTimeout(showForFirstVisit, 30000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [settings]);

  const close = () => setOpen(false);

  const handleClaim = () => {
    try {
      if (settings.welcomePopupCouponCode) {
        window.localStorage.setItem("weluxoWelcomeOfferCode", settings.welcomePopupCouponCode);
      }
    } catch (_error) {
      // The sign-in link remains usable when storage is unavailable.
    }
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      TransitionComponent={Fade}
      transitionDuration={{ enter: 850, exit: 450 }}
      sx={{ zIndex: 1500 }}
      aria-labelledby="welcome-offer-title"
      aria-describedby="welcome-offer-description"
      PaperProps={{
        sx: {
          width: "calc(100% - 32px)",
          maxWidth: 520,
          overflow: "hidden",
          borderRadius: { xs: 3, sm: 4 },
          bgcolor: "var(--color-surface)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 24px 80px rgba(43,43,43,0.24)",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          px: { xs: 3, sm: 5 },
          pt: { xs: 3, sm: 4 },
          pb: { xs: 1.5, sm: 2 },
          bgcolor: "var(--color-primary)",
          color: "#ffffff",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            width: 180,
            height: 180,
            right: -70,
            top: -80,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.12)",
          },
        }}
      >
        <IconButton
          aria-label="Close welcome offer"
          onClick={close}
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 1,
            color: "#ffffff",
            bgcolor: "rgba(255,255,255,0.12)",
            "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
          }}
        >
          <Close fontSize="small" />
        </IconButton>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ position: "relative", zIndex: 1 }}>
          <LocalOfferOutlined sx={{ fontSize: 19 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>
            {settings.welcomePopupEyebrow}
          </Typography>
        </Stack>
        <Typography id="welcome-offer-title" component="h2" sx={{ position: "relative", zIndex: 1, mt: 1.5, maxWidth: 390, fontSize: { xs: 30, sm: 38 }, lineHeight: 1.05, fontWeight: 950, letterSpacing: "-0.05em" }}>
          {settings.welcomePopupTitle}
        </Typography>
      </Box>

      <DialogContent sx={{ px: { xs: 3, sm: 5 }, pt: { xs: 2.5, sm: 3 }, pb: { xs: 3, sm: 4 } }}>
        <Typography id="welcome-offer-description" sx={{ color: "var(--color-text-secondary)", lineHeight: 1.65 }}>
          {settings.welcomePopupDescription}
        </Typography>

        {settings.welcomePopupCouponCode && (
          <Box sx={{ mt: 2.5, p: 1.5, border: "1px dashed var(--color-primary)", borderRadius: 2, bgcolor: "var(--color-primary-soft)", textAlign: "center" }}>
            <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Your welcome code</Typography>
            <Typography sx={{ mt: 0.35, color: "var(--color-primary)", fontSize: 20, fontWeight: 950, letterSpacing: "0.12em" }}>{settings.welcomePopupCouponCode}</Typography>
          </Box>
        )}

        <Button
          component={Link}
          href="/signin"
          onClick={handleClaim}
          fullWidth
          variant="contained"
          endIcon={<ArrowForwardRounded />}
          sx={{ mt: 2.5, py: 1.35, bgcolor: "var(--color-primary)", color: "#ffffff", fontWeight: 900, "&:hover": { bgcolor: "var(--color-primary-dark)" } }}
        >
          {settings.welcomePopupButtonLabel}
        </Button>
        <Typography sx={{ mt: 1.5, color: "var(--color-text-secondary)", fontSize: 11.5, textAlign: "center" }}>
          {settings.welcomePopupFinePrint}
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
