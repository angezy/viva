"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Container, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import RichTextEditor from "./RichTextEditor";
import { DetailPageSkeleton } from "../LoadingSkeletons";
import { sanitizeCmsHtml } from "../../lib/contentSanitizer";

const statuses = ["New", "Open", "In Progress", "Waiting for Customer", "Resolved", "Closed"];
const priorities = ["Low", "Normal", "High", "Urgent"];
const categories = ["Order", "Shipping", "Payment", "Refund", "Return", "Product Question", "Warranty", "Technical Issue", "Account", "Partnership"];

function htmlText(value) {
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

function normalizeTicketData(value) {
  return { ...value, ticket: { ...value.ticket, messages: (value.ticket?.messages || []).map((item) => ({ ...item, contentHtml: safeMessageHtml(item) })) } };
}

export default function AdminTicketView({ ticketId }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]);
  const [visibility, setVisibility] = useState("public");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => fetch(`/api/support/admin/tickets/${ticketId}`, { credentials: "include" })
    .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.error || "Unable to load ticket"))))
    .then((value) => {
      setData(normalizeTicketData(value));
      setStatus(value.ticket.status);
      setPriority(value.ticket.priority);
      setCategory(value.ticket.category);
      setAssignedAgentId(value.ticket.assignedAgentId || "");
      setTags((value.ticket.tags || []).join(", "));
    })
    .catch((loadError) => setError(loadError.message));

  // The ticket id is the only lifecycle input; load also initializes the control state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [ticketId]);

  const save = async () => {
    const response = await fetch(`/api/support/admin/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status, priority, category, assignedAgentId: assignedAgentId || null, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to update ticket");
    setData((prev) => ({ ...(prev || {}), ticket: body.ticket }));
  };

  const send = async (event) => {
    event.preventDefault();
    if (!htmlText(draft)) return setError("Write a message before sending.");
    setSending(true);
    setError("");
    try {
      const body = new FormData();
      body.append("contentHtml", draft);
      body.append("contentText", htmlText(draft));
      body.append("visibility", visibility);
      files.forEach((file) => body.append("attachments", file));
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, { method: "POST", body, credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to send message");
      setData((prev) => normalizeTicketData({ ...(prev || {}), ticket: result.ticket }));
      setDraft("");
      setFiles([]);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  if (error && !data) return <Container sx={{ py: 8 }}><Alert severity="error">{error}</Alert></Container>;
  if (!data) return <DetailPageSkeleton />;

  const { ticket, customer, orders, previousTickets } = data;
  const customerValue = (orders || []).reduce((sum, order) => sum + (Number(order.Total) || 0), 0);
  return (
    <Box component="main" sx={{ bgcolor: "#f8fafc", minHeight: "100vh", py: 3, color: "#0f172a" }}>
      <Container maxWidth="xl">
        <Button component={Link} href="/admin/tickets" startIcon={<ArrowBackIcon />} sx={{ mb: 2, textTransform: "none" }}>All tickets</Button>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e2e8f0" }}>
              <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 800 }}>CUSTOMER</Typography>
              <Typography component="h2" sx={{ fontWeight: 800, fontSize: 20 }}>{ticket.customerName}</Typography>
              <Typography sx={{ color: "#64748b", mb: 2 }}>{ticket.customerEmail}</Typography>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Customer profile</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 13 }}>User ID: {customer?.UserID || ticket.userId || "Guest"}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 13 }}>Member since: {customer?.CreatedAt ? new Date(customer.CreatedAt).toLocaleDateString() : "-"}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 13 }}>Customer value: ${customerValue.toFixed(2)}</Typography>
              <Typography sx={{ fontWeight: 800, mt: 3, mb: 1 }}>Orders</Typography>
              {orders?.length ? orders.map((order) => <Typography key={order.OrderId} sx={{ color: "#475569", fontSize: 13, mb: 0.5 }}>#{order.OrderId} · {order.Status} · ${order.Total}</Typography>) : <Typography sx={{ color: "#64748b", fontSize: 13 }}>No linked orders.</Typography>}
              <Typography sx={{ fontWeight: 800, mt: 3, mb: 1 }}>Previous tickets</Typography>
              {previousTickets?.length ? previousTickets.map((previous) => <Button key={previous.id} component={Link} href={`/admin/tickets/${previous.id}`} sx={{ display: "block", textAlign: "left", p: 0, mb: 0.75, color: "var(--color-primary)", textTransform: "none", fontSize: 12 }}>{previous.ticketNumber} · {previous.status}</Button>) : <Typography sx={{ color: "#64748b", fontSize: 13 }}>No previous tickets.</Typography>}
              <Typography sx={{ fontWeight: 800, mt: 3, mb: 1 }}>Ticket history</Typography>
              {ticket.events?.map((event) => <Typography key={event.id} sx={{ color: "#64748b", fontSize: 12, mb: 0.75 }}>{event.action} · {new Date(event.createdAt).toLocaleString()}</Typography>)}
            </Paper>
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 6
            }}>
            <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid #e2e8f0" }}>
                <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 800 }}>{ticket.ticketNumber}</Typography>
                <Typography component="h1" sx={{ fontWeight: 850, fontSize: 25 }}>{ticket.subject}</Typography>
              </Box>
              <Box sx={{ p: 2.5, maxHeight: "60vh", overflow: "auto", bgcolor: "#fbfdff" }}>
                {ticket.messages?.map((item) => (
                  <Box key={item.id} sx={{ mb: 1.5, p: 1.75, bgcolor: item.visibility === "internal" ? "#fff7ed" : "white", border: `1px solid ${item.visibility === "internal" ? "#fed7aa" : "#e2e8f0"}`, borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography sx={{ fontWeight: 800, fontSize: 12, color: item.visibility === "internal" ? "#c2410c" : "var(--color-primary)" }}>{item.senderType} · {item.visibility}</Typography>
                      <Typography sx={{ color: "#94a3b8", fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Typography>
                    </Stack>
                    <Box sx={{ mt: 1, color: "#334155", "& p": { mt: 0, mb: 1 }, "& ul": { pl: 3 } }} dangerouslySetInnerHTML={{ __html: safeMessageHtml(item) }} />
                    {item.attachments?.length > 0 && (
                      <Stack spacing={0.5} sx={{ mt: 1, pt: 1, borderTop: "1px solid #e2e8f0" }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 12 }}>Attachments</Typography>
                        {item.attachments.map((file, index) => <a key={`${file.url || "attachment"}-${index}`} href={file.url} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)", fontSize: 13 }}>{file.name || "Download attachment"}</a>)}
                      </Stack>
                    )}
                  </Box>
                ))}
              </Box>
              <Box component="form" onSubmit={send} sx={{ p: 2.5, borderTop: "1px solid #e2e8f0" }}>
                <RichTextEditor label={visibility === "internal" ? "Internal note" : "Reply to customer"} value={draft} onChange={setDraft} minHeight={220} />
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" gap={1.5} sx={{ mt: 2 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <TextField select size="small" label="Visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}><MenuItem value="public">Public reply</MenuItem><MenuItem value="internal">Internal note</MenuItem></TextField>
                    <Button component="label" variant="outlined" sx={{ textTransform: "none" }}>
                      Attach files
                      <input hidden multiple type="file" accept="image/*,.pdf,.txt,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                    </Button>
                    {files.length > 0 && <Typography sx={{ color: "#64748b", fontSize: 12 }}>{files.length} file{files.length === 1 ? "" : "s"} selected</Typography>}
                  </Stack>
                  <Button type="submit" disabled={sending} variant="contained" startIcon={<SendIcon />} sx={{ bgcolor: "var(--color-primary)", textTransform: "none" }}>{sending ? "Sending..." : "Add message"}</Button>
                </Stack>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
              </Box>
            </Paper>
          </Grid>

          <Grid
            size={{
              xs: 12,
              md: 3
            }}>
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e2e8f0" }}>
              <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 800 }}>TICKET CONTROLS</Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <TextField select fullWidth size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
                <TextField select fullWidth size="small" label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>{priorities.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
                <TextField select fullWidth size="small" label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
                <TextField fullWidth size="small" label="Assigned agent ID" value={assignedAgentId} onChange={(event) => setAssignedAgentId(event.target.value)} />
                <TextField fullWidth size="small" label="Tags (comma separated)" value={tags} onChange={(event) => setTags(event.target.value)} />
                <Button onClick={() => save().catch((saveError) => setError(saveError.message))} variant="contained" sx={{ bgcolor: "#0f172a", textTransform: "none" }}>Save controls</Button>
              </Stack>
              <Typography sx={{ color: "#64748b", fontSize: 12, mt: 2 }}>Workflow: New → Open → In Progress → Waiting for Customer → Resolved → Closed</Typography>
              <Chip label={ticket.status} sx={{ mt: 2 }} />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
