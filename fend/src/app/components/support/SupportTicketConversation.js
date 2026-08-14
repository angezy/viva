"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import RichTextEditor from "./RichTextEditor";

function textFromHtml(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
}

export default function SupportTicketConversation({ ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => fetch(`/api/support/tickets/${ticketId}`, { credentials: "include" }).then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.error || "Unable to load ticket")))).then((data) => setTicket(data.ticket)).catch((loadError) => setError(loadError.message));
  // Ticket changes are the only lifecycle input for this conversation view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [ticketId]);

  const send = async (event) => {
    event.preventDefault();
    if (!textFromHtml(message)) return setError("Please write a message first.");
    setSending(true); setError("");
    try {
      const body = new FormData(); body.append("contentHtml", message); body.append("contentText", textFromHtml(message)); files.forEach((file) => body.append("attachments", file));
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, { method: "POST", body, credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to send message");
      setTicket(data.ticket); setMessage(""); setFiles([]);
    } catch (sendError) { setError(sendError.message); } finally { setSending(false); }
  };

  if (error && !ticket) return <Container sx={{ py: 8 }}><Alert severity="error">{error}</Alert><Button component={Link} href="/signin" sx={{ mt: 2 }}>Sign in</Button></Container>;
  if (!ticket) return <Container sx={{ py: 8 }}><Typography>Loading ticket...</Typography></Container>;

  return (
    <Box component="main" sx={{ bgcolor: "#f6f9f5", minHeight: "100vh", py: { xs: 3, md: 6 }, color: "#12372a" }}>
      <Container maxWidth="md"><Button component={Link} href="/account/support" startIcon={<ArrowBackIcon />} sx={{ mb: 2, color: "#12372a", textTransform: "none", fontWeight: 800 }}>My support tickets</Button><Paper elevation={0} sx={{ border: "1px solid #dbe7dc", borderRadius: 3, overflow: "hidden" }}><Box sx={{ bgcolor: "#0e2b20", color: "white", p: { xs: 2.5, md: 4 } }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}><Box><Typography variant="overline" sx={{ color: "#a8d8b8", fontWeight: 800 }}>{ticket.ticketNumber}</Typography><Typography component="h1" sx={{ fontWeight: 850, fontSize: { xs: "1.8rem", md: "2.6rem" }, lineHeight: 1.05 }}>{ticket.subject}</Typography><Typography sx={{ color: "rgba(255,255,255,0.7)", mt: 1 }}>{ticket.category} · {ticket.priority}</Typography></Box><Chip label={ticket.status} sx={{ alignSelf: "flex-start", bgcolor: "#cbe8d2", color: "#12372a", fontWeight: 800 }} /></Stack></Box><Box sx={{ p: { xs: 2, md: 4 }, bgcolor: "#fbfdfb" }}>{ticket.messages?.map((item) => <Box key={item.id} sx={{ mb: 2, display: "flex", justifyContent: item.senderType === "customer" ? "flex-end" : "flex-start" }}><Box sx={{ maxWidth: "85%", bgcolor: item.senderType === "customer" ? "#dcebe0" : "white", border: "1px solid #dbe7dc", borderRadius: 2.5, p: 2 }}><Typography sx={{ color: "#3e785e", fontWeight: 800, fontSize: 12, textTransform: "uppercase", mb: 1 }}>{item.senderType === "customer" ? "You" : item.senderType} · {new Date(item.createdAt).toLocaleString()}</Typography><Box sx={{ color: "#365345", lineHeight: 1.7, "& p": { mt: 0, mb: 1 }, "& ul": { pl: 3 } }} dangerouslySetInnerHTML={{ __html: item.contentHtml || `<p>${item.contentText || ""}</p>` }} />{item.attachments?.length > 0 && <Stack sx={{ mt: 1 }} spacing={0.5}>{item.attachments.map((file) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" style={{ color: "#3e785e", fontSize: 13 }}>{file.name}</a>)}</Stack>}</Box></Box>)}</Box><Box component="form" onSubmit={send} sx={{ p: { xs: 2, md: 4 }, borderTop: "1px solid #dbe7dc" }}><RichTextEditor label="Reply" value={message} onChange={setMessage} minHeight={220} /><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}><Button component="label" variant="outlined" sx={{ borderRadius: 999, textTransform: "none", color: "#12372a", borderColor: "#8eaf96" }}>Attach files<input hidden multiple type="file" accept="image/*,.pdf,.txt,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></Button><Button type="submit" disabled={sending} variant="contained" startIcon={<SendIcon />} sx={{ borderRadius: 999, bgcolor: "#12372a", textTransform: "none", fontWeight: 800 }}>{sending ? "Sending..." : "Send reply"}</Button></Stack>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}</Box></Paper></Container>
    </Box>
  );
}
