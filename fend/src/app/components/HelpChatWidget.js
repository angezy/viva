"use client";

import { useEffect, useState } from "react";
import { Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";

const DEFAULT_CONFIG = {
  enabled: true,
  title: "Weluxo AI Concierge",
  subtitle: "Answers from the Weluxo help library",
  greeting: "Hi - I'm the Weluxo AI Concierge. What can I help you find today?",
  placeholder: "Ask about orders, shipping...",
  triggerLabel: "Open live chat",
  thinking: "Thinking...",
  error: "I'm temporarily unavailable. Please try again.",
};

export default function HelpChatWidget({ floating = true, initialOpen = false, triggerLabel }) {
  const [open, setOpen] = useState(initialOpen);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [messages, setMessages] = useState([
    { role: "assistant", text: DEFAULT_CONFIG.greeting },
  ]);

  useEffect(() => {
    let active = true;
    fetch("/api/chat/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setConfig((current) => ({ ...current, ...data }));
        setMessages((current) => current.length === 1 && current[0].role === "assistant"
          ? [{ role: "assistant", text: data.greeting || current[0].text }]
          : current);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function sendMessage(event) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || config.error);
      setMessages((current) => [...current, { role: "assistant", text: data.reply || config.error }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error.message || config.error }]);
    } finally {
      setSending(false);
    }
  }

  const panelSx = floating
    ? { position: "fixed", right: { xs: 12, md: 28 }, bottom: { xs: 72, md: 78 }, width: { xs: "calc(100vw - 24px)", sm: 360 }, zIndex: 1301 }
    : { position: "absolute", left: 0, top: "calc(100% + 10px)", width: { xs: "calc(100vw - 48px)", sm: 360 }, maxWidth: "calc(100vw - 48px)", zIndex: 20 };

  if (!config.enabled) return null;

  return (
    <Box sx={{ position: floating ? "static" : "relative", display: "inline-block" }}>
      {!open && (
        floating ? (
          <Tooltip title={triggerLabel || config.triggerLabel} placement="left">
            <IconButton type="button" onClick={() => setOpen(true)} aria-label={triggerLabel || config.triggerLabel} sx={{ position: "fixed", right: { xs: 14, md: 28 }, bottom: { xs: 16, md: 24 }, zIndex: 1300, width: 48, height: 48, bgcolor: "#12372a", color: "white", boxShadow: "0 12px 28px rgba(18,55,42,0.28)", "&:hover": { bgcolor: "#1b503b" } }}>
              <SupportAgentOutlinedIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Button type="button" onClick={() => setOpen(true)} startIcon={<SupportAgentOutlinedIcon />} sx={{ bgcolor: "#12372a", color: "white", borderRadius: 999, px: 2, py: 1.2, textTransform: "none", fontWeight: 800, boxShadow: "none", "&:hover": { bgcolor: "#1b503b" } }}>
            {triggerLabel || config.triggerLabel}
          </Button>
        )
      )}
      {open && (
        <Paper elevation={12} sx={{ ...panelSx, overflow: "hidden", borderRadius: 3, border: "1px solid #dbe7dc" }}>
          <Box sx={{ bgcolor: "#12372a", color: "white", px: 2, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box><Typography sx={{ fontWeight: 850, fontSize: 15 }}>{config.title}</Typography><Typography sx={{ color: "#cbe8d2", fontSize: 11 }}>{config.subtitle}</Typography></Box>
            <IconButton size="small" aria-label="Close chat" onClick={() => setOpen(false)} sx={{ color: "white" }}><CloseRoundedIcon fontSize="small" /></IconButton>
          </Box>
          <Stack spacing={1} sx={{ p: 1.5, height: 280, overflowY: "auto", bgcolor: "#f6f9f5" }} aria-live="polite">
            {messages.map((message, index) => (
              <Box key={`${message.role}-${index}`} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", px: 1.25, py: 1, borderRadius: message.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", bgcolor: message.role === "user" ? "#dcebe0" : "white", color: "#17352a", border: "1px solid #dbe7dc" }}>
                <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>{message.text}</Typography>
              </Box>
            ))}
            {sending && <Typography sx={{ color: "#607267", fontSize: 12 }}>{config.thinking}</Typography>}
          </Stack>
          <Box component="form" onSubmit={sendMessage} sx={{ display: "flex", gap: 1, p: 1.25, bgcolor: "white", borderTop: "1px solid #dbe7dc" }}>
            <TextField size="small" fullWidth value={input} onChange={(event) => setInput(event.target.value)} placeholder={config.placeholder} aria-label={config.placeholder} />
            <IconButton type="submit" aria-label="Send message" disabled={!input.trim() || sending} sx={{ bgcolor: "#12372a", color: "white", borderRadius: 2, "&:hover": { bgcolor: "#1b503b" } }}><SendRoundedIcon fontSize="small" /></IconButton>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
