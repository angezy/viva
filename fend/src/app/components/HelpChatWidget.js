"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Box, Button, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import { DEFAULT_SITE_SETTINGS, fetchSiteSettings } from "../lib/siteSettings";
import { loadSessionChatMessages, saveSessionChatMessages } from "../lib/chatSession";

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

function getConversationId() {
  if (typeof window === "undefined") return "";
  try {
    const saved = window.sessionStorage.getItem("weluxoChatConversationId");
    if (saved) return saved;
    const generated = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem("weluxoChatConversationId", generated);
    return generated;
  } catch (_error) {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}

function getStoredVisitor() {
  if (typeof window === "undefined") return { name: "", email: "" };
  try {
    const value = JSON.parse(window.sessionStorage.getItem("weluxoChatVisitor") || "null");
    return value && typeof value === "object" ? { name: value.name || "", email: value.email || "" } : { name: "", email: "" };
  } catch (_error) {
    return { name: "", email: "" };
  }
}

function greetingMessage(text) {
  return { role: "assistant", text, system: true };
}

function lastSeenAgentStorageKey(conversationId) {
  return `weluxoChatLastSeenAgentId:${conversationId}`;
}

function getLastSeenAgentId(conversationId) {
  if (typeof window === "undefined") return 0;
  try {
    return Math.max(0, Number(window.sessionStorage.getItem(lastSeenAgentStorageKey(conversationId))) || 0);
  } catch (_error) {
    return 0;
  }
}

export default function HelpChatWidget({ floating = true, initialOpen = false, triggerLabel }) {
  const messagesContainerRef = useRef(null);
  const [open, setOpen] = useState(initialOpen);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [conversationId] = useState(getConversationId);
  const [visitor, setVisitor] = useState(getStoredVisitor);
  const [started, setStarted] = useState(() => Boolean(getStoredVisitor().name && getStoredVisitor().email));
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const [humanSupportEnabled, setHumanSupportEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("weluxoChatHumanSupport") === "true";
  });
  const [lastReplyId, setLastReplyId] = useState(0);
  const [latestAgentId, setLatestAgentId] = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState(() => [
    greetingMessage(DEFAULT_CONFIG.greeting),
    ...loadSessionChatMessages(conversationId),
  ]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/chat/config").then((response) => (response.ok ? response.json() : null)),
      fetchSiteSettings().catch(() => DEFAULT_SITE_SETTINGS),
    ])
      .then(([data, site]) => {
        if (!active) return;
        const configured = data || {};
        const nextConfig = {
          ...DEFAULT_CONFIG,
          ...configured,
          title: configured.title && configured.title !== DEFAULT_CONFIG.title ? configured.title : `${site.siteName} AI Concierge`,
          subtitle: configured.subtitle && configured.subtitle !== DEFAULT_CONFIG.subtitle ? configured.subtitle : `Answers from the ${site.siteName} help library`,
          greeting: configured.greeting && configured.greeting !== DEFAULT_CONFIG.greeting ? configured.greeting : `Hi - I'm the ${site.siteName} AI Concierge. What can I help you find today?`,
          fallback: configured.fallback && configured.fallback !== DEFAULT_CONFIG.fallback ? configured.fallback : `I could not find an exact answer in the ${site.siteName} help library. Try asking about shipping, an order, returns, payments, products, or your account.`,
        };
        setConfig(nextConfig);
        setMessages((current) => current.map((message, index) => (
          index === 0 && message.system
            ? { ...message, text: nextConfig.greeting || message.text }
            : message
        )));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!started || !conversationId) return;
    saveSessionChatMessages(conversationId, messages);
  }, [conversationId, messages, started]);

  useEffect(() => {
    if (!started || !conversationId) return undefined;
    let active = true;

    const loadHistory = async () => {
      setHistoryLoaded(false);
      try {
        const response = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok || !Array.isArray(data.messages)) return;
        const history = data.messages
          .filter((message) => message?.text && (message.senderType === "customer" || message.senderType === "agent"))
          .map((message) => ({
            role: message.senderType === "customer" ? "user" : "assistant",
            text: message.text,
            messageId: message.id,
            createdAt: message.createdAt,
          }));
        const newestMessageId = Math.max(0, ...history.map((message) => Number(message.messageId) || 0));
        const agentMessages = history.filter((message) => message.role === "assistant");
        const newestAgentId = Math.max(0, ...agentMessages.map((message) => Number(message.messageId) || 0));
        const lastSeenAgentId = getLastSeenAgentId(conversationId);
        if (history.length) {
          setMessages((current) => [greetingMessage(current[0]?.system ? current[0].text : DEFAULT_CONFIG.greeting), ...history]);
        }
        setLastReplyId(newestMessageId);
        setLatestAgentId(newestAgentId);
        setUnreadCount(agentMessages.filter((message) => Number(message.messageId) > lastSeenAgentId).length);
      } catch (_error) {
        // Keep the chat usable if history is temporarily unavailable.
      } finally {
        if (active) setHistoryLoaded(true);
      }
    };

    loadHistory();
    return () => { active = false; };
  }, [conversationId, started]);

  useEffect(() => {
    if (!humanSupportEnabled || !conversationId || !historyLoaded) return undefined;
    let active = true;
    let requestInFlight = false;

    const pollReplies = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(`/api/chat/replies?conversationId=${encodeURIComponent(conversationId)}&afterId=${lastReplyId}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok || !Array.isArray(data.messages) || data.messages.length === 0) return;
        const replies = data.messages.filter((message) => message?.text).map((message) => ({ role: "assistant", text: message.text, messageId: message.id }));
        if (!replies.length) return;
        setMessages((current) => {
          const knownIds = new Set(current.map((message) => String(message.messageId || "")).filter(Boolean));
          return [...current, ...replies.filter((message) => !knownIds.has(String(message.messageId)))];
        });
        const newestAgentId = Math.max(lastReplyId, ...replies.map((message) => Number(message.messageId) || 0));
        setLastReplyId(newestAgentId);
        setLatestAgentId((current) => Math.max(current, newestAgentId));
        setUnreadCount((current) => current + replies.length);
      } catch (_error) {
        // Polling is best effort; the normal chat remains usable if Telegram is offline.
      } finally {
        requestInFlight = false;
      }
    };

    pollReplies();
    const interval = window.setInterval(pollReplies, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [conversationId, historyLoaded, humanSupportEnabled, lastReplyId]);

  useEffect(() => {
    if (!open || !started || !messagesContainerRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open, sending, started]);

  function dismissNewMessageNotice() {
    setUnreadCount(0);
    try {
      window.sessionStorage.setItem(lastSeenAgentStorageKey(conversationId), String(latestAgentId));
    } catch (_storageError) {
      // Session storage is optional.
    }
  }

  async function startChat(event) {
    event?.preventDefault();
    const name = visitor.name.trim();
    const email = visitor.email.trim().toLowerCase();
    setStartError("");
    if (!name) {
      setStartError("Please enter your name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStartError("Please enter a valid email address.");
      return;
    }

    setStarting(true);
    try {
      const response = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, name, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to start live chat");
      const savedVisitor = { name: data.visitor?.name || name, email: data.visitor?.email || email };
      setVisitor(savedVisitor);
      setStarted(true);
      setHumanSupportEnabled(Boolean(data.humanSupport));
      setMessages([greetingMessage(config.greeting)]);
      setLastReplyId(0);
      setLatestAgentId(0);
      setUnreadCount(0);
      setHistoryLoaded(false);
      try {
        window.sessionStorage.setItem("weluxoChatVisitor", JSON.stringify(savedVisitor));
        window.sessionStorage.setItem("weluxoChatHumanSupport", String(Boolean(data.humanSupport)));
      } catch (_storageError) {
        // Session storage is optional.
      }
    } catch (error) {
      setStartError(error.message || "Unable to start live chat");
    } finally {
      setStarting(false);
    }
  }

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
        body: JSON.stringify({ message, conversationId, name: visitor.name, email: visitor.email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || config.error);
      if (data.humanSupport) {
        setHumanSupportEnabled(true);
        setConfig((current) => ({ ...current, title: `${current.title.replace(/ AI Concierge$/, "")} Support`, subtitle: "A team member will reply from Telegram" }));
        try { window.sessionStorage.setItem("weluxoChatHumanSupport", "true"); } catch (_storageError) {}
      }
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
            <Badge badgeContent={unreadCount} color="error" max={9} overlap="circular" sx={{ position: "fixed", right: { xs: 14, md: 28 }, bottom: { xs: 16, md: 24 }, zIndex: 1300 }}>
              <IconButton type="button" onClick={() => setOpen(true)} aria-label={triggerLabel || config.triggerLabel} sx={{ width: 48, height: 48, bgcolor: "var(--color-primary)", color: "#ffffff", boxShadow: "0 12px 28px rgba(37,99,235,0.28)", "&:hover": { bgcolor: "var(--color-primary-dark)" } }}>
                <SupportAgentOutlinedIcon />
              </IconButton>
            </Badge>
          </Tooltip>
        ) : (
          <Badge badgeContent={unreadCount} color="error" max={9}>
            <Button type="button" onClick={() => setOpen(true)} startIcon={<SupportAgentOutlinedIcon />} sx={{ bgcolor: "var(--color-primary)", color: "#ffffff", borderRadius: 999, px: 2, py: 1.2, textTransform: "none", fontWeight: 800, boxShadow: "none", "&:hover": { bgcolor: "var(--color-primary-dark)" } }}>
              {triggerLabel || config.triggerLabel}
            </Button>
          </Badge>
        )
      )}
      {open && (
        <Paper elevation={12} sx={{ ...panelSx, overflow: "hidden", borderRadius: 3, border: "1px solid var(--color-border)" }}>
          <Box sx={{ bgcolor: "var(--color-primary)", color: "#ffffff", px: 2, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box><Typography sx={{ fontWeight: 850, fontSize: 15 }}>{config.title}</Typography><Typography sx={{ color: "#dbe8ff", fontSize: 11 }}>{config.subtitle}</Typography></Box>
            <IconButton size="small" aria-label="Close chat" onClick={() => setOpen(false)} sx={{ color: "white" }}><CloseRoundedIcon fontSize="small" /></IconButton>
          </Box>
          {!started ? (
            <Box component="form" onSubmit={startChat} sx={{ p: 2, bgcolor: "var(--color-background)" }}>
              <Typography sx={{ color: "var(--color-text-primary)", fontWeight: 800, mb: 0.5 }}>Before we start</Typography>
              <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 12, lineHeight: 1.5, mb: 1.5 }}>Share your name and email so our support team can reply to you.</Typography>
              <Stack spacing={1.25}>
                <TextField size="small" label="Your name" value={visitor.name} onChange={(event) => { setVisitor((current) => ({ ...current, name: event.target.value })); setStartError(""); }} required autoComplete="name" />
                <TextField size="small" label="Email address" type="email" value={visitor.email} onChange={(event) => { setVisitor((current) => ({ ...current, email: event.target.value })); setStartError(""); }} required autoComplete="email" />
                {startError && <Typography role="alert" sx={{ color: "#b42318", fontSize: 12 }}>{startError}</Typography>}
                <Button type="submit" variant="contained" disabled={starting} sx={{ bgcolor: "var(--color-primary)", borderRadius: 999, textTransform: "none", fontWeight: 800 }}>
                  {starting ? "Starting chat..." : "Start live chat"}
                </Button>
              </Stack>
            </Box>
          ) : (
            <>
              {unreadCount > 0 && (
                <Box role="status" sx={{ px: 1.5, py: 1, bgcolor: "#b42318", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                    {unreadCount === 1 ? "New message arrived" : `${unreadCount} new messages arrived`}
                  </Typography>
                  <Button type="button" size="small" onClick={dismissNewMessageNotice} sx={{ minWidth: 0, color: "#ffffff", borderColor: "rgba(255,255,255,0.7)", textTransform: "none", fontSize: 11 }} variant="outlined">
                    Mark read
                  </Button>
                </Box>
              )}
              <Stack ref={messagesContainerRef} spacing={1} sx={{ p: 1.5, height: 280, overflowY: "auto", bgcolor: "var(--color-background)" }} aria-live="polite">
                {messages.map((message, index) => (
                  <Box key={message.messageId ? `message-${message.messageId}` : `${message.role}-${index}`} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", px: 1.25, py: 1, borderRadius: message.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", bgcolor: message.role === "user" ? "var(--color-primary-soft)" : "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>{message.text}</Typography>
                  </Box>
                ))}
                {sending && <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{config.thinking}</Typography>}
              </Stack>
              <Box component="form" onSubmit={sendMessage} sx={{ display: "flex", gap: 1, p: 1.25, bgcolor: "#ffffff", borderTop: "1px solid var(--color-border)" }}>
                <TextField size="small" fullWidth value={input} onChange={(event) => setInput(event.target.value)} placeholder={config.placeholder} aria-label={config.placeholder} />
                <IconButton type="submit" aria-label="Send message" disabled={!input.trim() || sending} sx={{ bgcolor: "var(--color-accent)", color: "var(--color-text-primary)", borderRadius: 2, "&:hover": { bgcolor: "var(--color-accent-dark)" } }}><SendRoundedIcon fontSize="small" /></IconButton>
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
