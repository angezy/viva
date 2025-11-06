"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText, Skeleton } from "@mui/material";

export default function NotificationsSection({ loading: parentLoading }) {
  const [loading, setLoading] = useState(parentLoading ?? true);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetch("http://localhost:5000/api/dashboard/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data)) {
          setNotes(data.map((n, i) => ({ id: n.id ?? i, text: n.text ?? n.message ?? String(n), time: n.time ?? n.createdAt })));
        } else {
          setNotes([]);
        }
      })
      .catch((err) => console.error("Notifications fetch error:", err))
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  const isLoading = parentLoading ?? loading;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
          {isLoading ? (
            <List>
              {Array.from({ length: 3 }).map((_, i) => (
                <ListItem key={i}>
                  <Skeleton width="100%" />
                </ListItem>
              ))}
            </List>
          ) : (
            <List>
              {notes.map((n) => (
                <ListItem key={n.id} divider>
                  <ListItemText primary={n.text} secondary={n.time} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
