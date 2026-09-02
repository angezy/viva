"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import RichTextEditor from "./RichTextEditor";
import { DetailPageSkeleton } from "../LoadingSkeletons";
import { sanitizeCmsHtml } from "../../lib/contentSanitizer";

function textFromHtml(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;",
    "'": "&#39;",
  }[character]));
}

function safeMessageHtml(item) {
  const fallback = "<p>" + escapeHtml(item?.contentText) + "</p>";
  return sanitizeCmsHtml(item?.contentHtml || fallback);
}

function normalizeTicket(ticketData) {
  return { ...ticketData, messages: (ticketData?.messages || []).map((item) => ({ ...item, contentHtml: safeMessageHtml(item) })) };
}

export default function SupportTicketConversation({ ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => fetch(`/api/support/tickets/${ticketId}`, { credentials: "include" })
    .then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.error || "Unable to load ticket"))))
    .then((data) => setTicket(normalizeTicket(data.ticket)))
    .catch((loadError) => setError(loadError.message));

  // Ticket changes are the only lifecycle input for this conversation view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [ticketId]);

  const send = async (event) => {
    event.preventDefault();
    if (!textFromHtml(message)) return setError("Please write a message first.");
    setSending(true);
    setError("");
    try {
      const body = new FormData();
      body.append("contentHtml", message);
      body.append("contentText", textFromHtml(message));
      files.forEach((file) => body.append("attachments", file));
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, { method: "POST", body, credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to send message");
      setTicket(normalizeTicket(data.ticket));
      setMessage("");
      setFiles([]);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  if (error && !ticket) return <Container sx={{ py: 8 }}><Alert severity="error">{error}</Alert><Button component={Link} href="/signin" sx={{ mt: 2 }}>Sign in</Button></Container>;
  if (!ticket) return <DetailPageSkeleton />;

  return (
    <Box component="main" sx={{ bgcolor: "var(--color-background)", minHeight: "100vh", py: { xs: 3, md: 6 }, color: "var(--color-text-primary)", "& .MuiPaper-root": { borderColor: "var(--color-border)" }, "& .MuiPaper-root > .MuiBox-root:first-of-type": { bgcolor: "#ffffff", color: "var(--color-text-primary)" }, "& .MuiPaper-root > .MuiBox-root:first-of-type .MuiTypography-root": { color: "var(--color-text-primary)" }, "& .MuiPaper-root > .MuiBox-root:first-of-type .MuiTypography-overline": { color: "var(--color-accent)" }, "& .MuiPaper-root .MuiButton-root": { color: "var(--color-primary)" }, "& .MuiPaper-root .MuiButton-contained": { bgcolor: "var(--color-primary)", color: "#ffffff" } }}>
      <Container maxWidth="md">
        <Button component={Link} href="/account/support" startIcon={<ArrowBackIcon />} sx={{ mb: 2, color: "var(--color-primary-dark)", textTransform: "none", fontWeight: 800 }}>My support tickets</Button>
        <Paper elevation={0} sx={{ border: "1px solid var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ bgcolor: "var(--color-primary-dark)", color: "white", p: { xs: 2.5, md: 4 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="overline" sx={{ color: "var(--color-primary-light)", fontWeight: 800 }}>{ticket.ticketNumber}</Typography>
                <Typography component="h1" sx={{ fontWeight: 850, fontSize: { xs: "1.8rem", md: "2.6rem" }, lineHeight: 1.05 }}>{ticket.subject}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 1 }}>{ticket.category} · {ticket.priority}</Typography>
              </Box>
              <Chip label={ticket.status} sx={{ alignSelf: "flex-start", bgcolor: "var(--color-primary-soft)", color: "var(--color-primary-dark)", fontWeight: 800 }} />
            </Stack>
          </Box>
          <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: "var(--color-surface-muted)" }}>
            {ticket.messages?.map((item) => <Box key={item.id} sx={{ mb: 2, display: "flex", justifyContent: item.senderType === "customer" ? "flex-end" : "flex-start" }}><Box sx={{ maxWidth: "85%", bgcolor: item.senderType === "customer" ? "var(--color-primary-soft)" : "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 2.5, p: 2 }}><Typography sx={{ color: "var(--color-primary)", fontWeight: 800, fontSize: 12, textTransform: "uppercase", mb: 1 }}>{item.senderType === "customer" ? "You" : item.senderType} · {new Date(item.createdAt).toLocaleString()}</Typography><Box sx={{ color: "var(--color-text-secondary)", lineHeight: 1.7, "& p": { mt: 0, mb: 1 }, "& ul": { pl: 3 } }} dangerouslySetInnerHTML={{ __html: safeMessageHtml(item) }} />{item.attachments?.length > 0 && <Stack sx={{ mt: 1 }} spacing={0.5}>{item.attachments.map((file, index) => <a key={`${file.url || "attachment"}-${index}`} href={file.url} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)", fontSize: 13 }}>{file.name || "Download attachment"}</a>)}</Stack>}</Box></Box>)}
          </Box>
          <Box component="form" onSubmit={send} sx={{ p: { xs: 2, md: 4 }, borderTop: "1px solid var(--color-border)" }}>
            <RichTextEditor label="Reply" value={message} onChange={setMessage} minHeight={220} />
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5} sx={{ mt: 2 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Button component="label" variant="outlined" sx={{ borderRadius: 999, textTransform: "none", color: "var(--color-primary-dark)", borderColor: "var(--color-primary-light)" }}>
                  Attach files
                  <input hidden multiple type="file" accept="image/*,.pdf,.txt,.docx" onChange={(event) => { setFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
                </Button>
                {files.length > 0 && <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{files.map((file) => file.name).join(", ")}</Typography>}
              </Stack>
              <Button type="submit" disabled={sending} variant="contained" startIcon={<SendIcon />} sx={{ borderRadius: 999, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>{sending ? "Sending..." : "Send reply"}</Button>
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
