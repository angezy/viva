"use client";
import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Typography, List, ListItem, ListItemText, Skeleton } from "@mui/material";

export default function NotificationsSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading ?? true);
  const [notes, setNotes] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard/notifications", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Notifications request failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data)) {
          setNotes(data.map((n, i) => ({
            id: n.id ?? i,
            title: n.title ?? "Notification",
            text: n.text ?? n.message ?? String(n),
            time: n.time ?? n.createdAt,
            isRead: Boolean(n.isRead),
          })));
        } else {
          setNotes([]);
        }
      })
      .catch((err) => {
        console.error("Notifications fetch error:", err);
        mounted && setError(err.message || "Unable to load notifications");
      })
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  const isLoading = parentLoading ?? loading;

  const markAsRead = async (id) => {
    setError("");
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/dashboard/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isRead: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to update notification");
      }
      setNotes((current) => current.map((note) => note.id === id ? { ...note, isRead: true } : note));
    } catch (err) {
      setError(err.message || "Unable to update notification");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {isLoading ? (
            <List>
              {Array.from({ length: 3 }).map((_, i) => (
                <ListItem key={i}>
                  <Skeleton variant="rounded" width="100%" height={48} sx={{ borderRadius: 1.5 }} />
                </ListItem>
              ))}
            </List>
          ) : (
            <List>
              {notes.map((n) => (
                <ListItem
                  key={n.id}
                  divider
                  secondaryAction={!n.isRead ? (
                    <Button size="small" disabled={updatingId === n.id} onClick={() => markAsRead(n.id)}>
                      Mark read
                    </Button>
                  ) : null}
                >
                  <ListItemText
                    primary={n.title}
                    secondary={`${n.text}${n.time ? ` • ${new Date(n.time).toLocaleString()}` : ""}`}
                    primaryTypographyProps={{ fontWeight: n.isRead ? 400 : 700 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
