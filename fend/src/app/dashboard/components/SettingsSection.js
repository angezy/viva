"use client";
import React, { useState, useEffect } from "react";
import { Box, Card, CardContent, Typography, FormControlLabel, Switch, Skeleton } from "@mui/material";

export default function SettingsSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading);
  const [emailNotif, setEmailNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setEmailNotif(Boolean(data.emailNotifications));
        setDarkMode(Boolean(data.darkMode));
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));

    return () => (mounted = false);
  }, []);

  return (
    <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={2}>Store Settings</Typography>
        {loading ? (
          <Box>
            <Skeleton width={160} height={32} sx={{ mb: 1 }} />
            <Skeleton width={140} height={32} />
          </Box>
        ) : (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={emailNotif}
                  onChange={() => setEmailNotif((s) => !s)}
                />
              }
              label="Email Notifications"
            />
            <br />
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  onChange={() => setDarkMode((s) => !s)}
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
