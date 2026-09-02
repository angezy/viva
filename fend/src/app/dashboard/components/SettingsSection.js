"use client";
import React, { useState, useEffect } from "react";
import { Alert, Box, Card, CardContent, Typography, FormControlLabel, Switch, Skeleton, Stack } from "@mui/material";

export default function SettingsSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading);
  const [emailNotif, setEmailNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => setLoading(true));
    fetch('/api/dashboard/settings')
      .then((r) => {
        if (!r.ok) throw new Error(`Settings request failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        setEmailNotif(Boolean(data.emailNotifications));
        setDarkMode(Boolean(data.darkMode));
      })
      .catch((err) => mounted && setError(err.message || "Unable to load settings"))
      .finally(() => mounted && setLoading(false));

    return () => (mounted = false);
  }, []);

  const saveSetting = async (key, value) => {
    const previous = key === "emailNotifications" ? emailNotif : darkMode;
    const setValue = key === "emailNotifications" ? setEmailNotif : setDarkMode;
    setError("");
    setValue(value);
    setSaving(true);
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to save setting');
      }
    } catch (err) {
      setValue(previous);
      setError(err.message || 'Unable to save setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={2}>Store Settings</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Stack spacing={1.25}>
            {[0, 1].map((item) => (
              <Stack key={item} direction="row" spacing={1.25} alignItems="center">
                <Skeleton variant="rounded" width={38} height={22} sx={{ borderRadius: 99 }} />
                <Skeleton variant="text" width={item === 0 ? 160 : 140} height={24} />
              </Stack>
            ))}
          </Stack>
        ) : (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={emailNotif}
                  disabled={saving}
                  onChange={(event) => saveSetting("emailNotifications", event.target.checked)}
                />
              }
              label="Email Notifications"
            />
            <br />
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  disabled={saving}
                  onChange={(event) => saveSetting("darkMode", event.target.checked)}
                />
              }
              label="Dark Mode"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
