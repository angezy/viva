"use client";

import { useEffect, useState } from "react";
import { Box, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { DEFAULT_CONSENT, getConsent, setConsent } from "../lib/cookies";

const OPTIONS = [
  { key: "preferences", label: "Preferences", description: "Remember optional storefront choices when they are available." },
  { key: "analytics", label: "Analytics", description: "Allow future privacy-aware measurement tools." },
  { key: "marketing", label: "Marketing", description: "Allow future advertising or campaign measurement tools." },
];

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [choices, setChoices] = useState(DEFAULT_CONSENT);

  useEffect(() => {
    const existing = getConsent();
    if (existing) {
      setChoices(existing);
      return;
    }
    setOpen(true);
  }, []);

  function save(nextChoices) {
    setChoices(setConsent(nextChoices));
    setOpen(false);
    setSettingsOpen(false);
  }

  if (!open) {
    return (
      <Box sx={{ position: "fixed", zIndex: 1399, left: 16, bottom: 16 }}>
        <Button
          onClick={() => {
            setChoices(getConsent() || DEFAULT_CONSENT);
            setSettingsOpen(true);
            setOpen(true);
          }}
          variant="outlined"
          size="small"
          sx={{ bgcolor: "#ffffff", color: "var(--color-primary)", borderColor: "var(--color-primary)", textTransform: "none", boxShadow: "0 8px 24px rgba(43,43,43,0.12)" }}
        >
          Privacy choices
        </Button>
      </Box>
    );
  }

  return (
    <Box
      role="dialog"
      aria-label="Cookie preferences"
      aria-modal="false"
      sx={{
        position: "fixed",
        zIndex: 1400,
        left: { xs: 12, md: 24 },
        right: { xs: 12, md: 24 },
        bottom: 16,
        maxWidth: 760,
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        color: "var(--color-text-primary)",
        bgcolor: "#ffffff",
        border: "1px solid var(--color-border)",
        boxShadow: "0 18px 55px rgba(43,43,43,0.14)",
        "& .MuiFormControlLabel-label": { color: "var(--color-text-primary)" },
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.75 }}>Your cookie choices</Typography>
      <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
        Weluxo uses necessary cookies for sign-in, cart continuity, checkout, security, and remembering this choice. Optional cookies are currently not used by the store.
      </Typography>

      {settingsOpen && (
        <Stack spacing={0.25} sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Checkbox checked disabled sx={{ color: "#93c5fd", "&.Mui-disabled": { color: "#93c5fd" } }} />}
            label={<Typography sx={{ color: "#f8fafc", fontWeight: 700 }}>Necessary — always on</Typography>}
          />
          {OPTIONS.map((option) => (
            <Box key={option.key}>
              <FormControlLabel
                control={<Checkbox checked={Boolean(choices[option.key])} onChange={(event) => setChoices((current) => ({ ...current, [option.key]: event.target.checked }))} sx={{ color: "rgba(226,232,240,0.7)", "&.Mui-checked": { color: "#60a5fa" } }} />}
                label={<Typography sx={{ color: "var(--color-text-primary)", fontWeight: 700 }}>{option.label}</Typography>}
              />
              <Typography variant="caption" sx={{ display: "block", ml: 5.5, color: "var(--color-text-secondary)" }}>{option.description}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button onClick={() => setSettingsOpen((value) => !value)} sx={{ color: "var(--color-primary)", textTransform: "none" }}>
          {settingsOpen ? "Hide settings" : "Cookie settings"}
        </Button>
        <Button onClick={() => save({ necessary: true, preferences: false, analytics: false, marketing: false })} variant="outlined" sx={{ color: "var(--color-primary)", borderColor: "var(--color-primary)", textTransform: "none" }}>
          Reject optional
        </Button>
        {settingsOpen ? (
          <Button onClick={() => save(choices)} variant="contained" sx={{ textTransform: "none", fontWeight: 800 }}>Save choices</Button>
        ) : (
          <Button onClick={() => save({ necessary: true, preferences: true, analytics: true, marketing: true })} variant="contained" sx={{ textTransform: "none", fontWeight: 800 }}>Accept optional</Button>
        )}
      </Stack>
    </Box>
  );
}
