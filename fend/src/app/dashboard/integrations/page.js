"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton, InputAdornment, MenuItem,
  Stack, TextField, Typography,
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import GoogleIcon from "@mui/icons-material/Google";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

const GROUP_ICONS = {
  database: StorageOutlinedIcon, sendpulse: EmailOutlinedIcon, cj: LocalShippingOutlinedIcon, hypersku: LocalShippingOutlinedIcon,
  google: GoogleIcon, telegram: SendOutlinedIcon, stripe: CreditCardOutlinedIcon,
  chatbot: SmartToyOutlinedIcon, support: NotificationsNoneOutlinedIcon, tinymce: ArticleOutlinedIcon,
};

function targetLabel(target) {
  return target === "frontend" ? "Frontend env" : target === "mixed" ? "Backend + frontend env" : "Backend env";
}

function statusFor(group) {
  if (group.optional && !group.configured) return { label: "Optional", color: "default" };
  if (group.configured) return { label: "Configured", color: "success" };
  if (group.configuredCount > 0) return { label: "Partially configured", color: "warning" };
  return { label: "Needs setup", color: "default" };
}

export default function IntegrationsPage() {
  const [groups, setGroups] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [clears, setClears] = useState({});
  const [visible, setVisible] = useState({});
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const readyCount = useMemo(() => groups.filter((group) => group.configured).length, [groups]);
  const missingCount = useMemo(() => groups.filter((group) => !group.configured && !group.optional).length, [groups]);

  async function load({ initial = false } = {}) {
    if (initial) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/integrations", { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to load integrations");
      setGroups(Array.isArray(body.groups) ? body.groups : []);
      setNote(body.note || "");
    } catch (loadError) {
      setError(loadError.message || "Unable to load integrations");
    } finally {
      if (initial) setLoading(false); else setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load({ initial: true }); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openEditor(group) {
    const nextDrafts = {};
    const nextClears = {};
    group.fields.forEach((field) => {
      nextDrafts[field.key] = field.type === "secret" ? "" : (field.value || "");
      nextClears[field.key] = false;
    });
    setDrafts(nextDrafts);
    setClears(nextClears);
    setVisible({});
    setEditing(group);
    setError("");
    setMessage("");
  }

  function updateDraft(key, value) {
    setDrafts((current) => ({ ...current, [key]: value }));
    setClears((current) => ({ ...current, [key]: false }));
  }

  async function save(event) {
    event.preventDefault();
    if (!editing || saving) return;
    const updates = {};
    editing.fields.forEach((field) => {
      const value = String(drafts[field.key] ?? "");
      if (field.type === "secret") {
        if (clears[field.key]) updates[field.key] = { clear: true };
        else if (value.trim()) updates[field.key] = value;
      } else updates[field.key] = value;
    });
    if (!Object.keys(updates).length) {
      setError("Enter a new secret value or select Clear for the secret you want to change.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/integrations", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save integration configuration");
      setGroups(Array.isArray(body.groups) ? body.groups : []);
      setEditing(null);
      setMessage(`Saved ${body.changedKeys?.length || 0} integration setting${body.changedKeys?.length === 1 ? "" : "s"}.${body.restartRequired ? " Restart the affected server for all changes to take effect." : ""}`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save integration configuration");
    } finally {
      setSaving(false);
    }
  }

  async function testHyperSku() {
    if (testing) return;
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/dashboard/integrations/hypersku/ping", { credentials: "include", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "HyperSKU connection failed");
      setMessage(`HyperSKU connection succeeded${Number.isFinite(body.countryCount) ? ` (${body.countryCount} country codes available).` : "."}`);
    } catch (testError) {
      setError(testError.message || "HyperSKU connection failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto", minHeight: "100%" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 850, letterSpacing: "0.14em" }}>Operations</Typography>
          <Typography component="h1" sx={{ mt: 0.5, color: "#0f172a", fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: "-0.04em" }}>Integrations</Typography>
          <Typography sx={{ mt: 0.75, color: "#64748b", maxWidth: 780 }}>View and configure the environment variables that connect the store to email, suppliers, payments, sign-in, support, AI, and content editing services.</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`${readyCount}/${groups.length || 0} ready`} color="success" variant="outlined" />
          {missingCount > 0 && <Chip label={`${missingCount} need setup`} color="warning" variant="outlined" />}
          <Button variant="outlined" onClick={() => load()} disabled={loading || refreshing} startIcon={refreshing ? <CircularProgress size={17} /> : <RefreshOutlinedIcon />} sx={{ textTransform: "none", borderRadius: 2 }}>{refreshing ? "Refreshing" : "Refresh"}</Button>
        </Stack>
      </Stack>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 3, borderRadius: 2 }}>
        Private credentials are masked and never returned in plain text. Keep service secrets out of <code>NEXT_PUBLIC_*</code> variables; TinyMCE is browser-safe. Never commit a real <code>.env</code> file. {note}
      </Alert>

      {loading ? <Stack alignItems="center" sx={{ py: 10 }}><CircularProgress size={30} /></Stack> : (
        <Grid container spacing={2.5}>
          {groups.map((group) => {
            const Icon = GROUP_ICONS[group.id] || NotificationsNoneOutlinedIcon;
            const status = statusFor(group);
            return <Grid key={group.id} size={{ xs: 12, md: group.id === "cj" ? 12 : 6 }}>
              <Card sx={{ height: "100%", borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 8px 25px rgba(15,23,42,0.05)" }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box sx={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: "var(--color-primary-soft)", color: "var(--color-primary)" }}><Icon /></Box>
                      <Box><Typography sx={{ color: "#0f172a", fontSize: 18, fontWeight: 850 }}>{group.title}</Typography><Typography sx={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}>{targetLabel(group.target)}</Typography></Box>
                    </Stack>
                    <Chip size="small" label={status.label} color={status.color} variant={status.color === "default" ? "outlined" : "filled"} />
                  </Stack>
                  <Typography sx={{ mt: 1.5, mb: 2, color: "#64748b", fontSize: 13, lineHeight: 1.55 }}>{group.description}</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack spacing={0.8}>{group.fields.map((field) => <Stack key={field.key} direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ minHeight: 31 }}>
                    <Box sx={{ minWidth: 0 }}><Typography sx={{ color: "#334155", fontSize: 12, fontWeight: 750 }}>{field.label}</Typography><Typography sx={{ color: "#94a3b8", fontSize: 10, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.key}</Typography></Box>
                    <Typography sx={{ flexShrink: 0, maxWidth: "48%", color: field.configured ? "#475569" : "#cbd5e1", fontSize: 12, fontFamily: field.type === "secret" || field.value ? "monospace" : "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.placeholderValue ? "Placeholder value" : field.value || "Not set"}</Typography>
                  </Stack>)}</Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
                    <Button fullWidth variant="outlined" onClick={() => openEditor(group)} startIcon={<EditOutlinedIcon />} sx={{ borderRadius: 2, textTransform: "none", fontWeight: 750 }}>Edit configuration</Button>
                    {group.id === "hypersku" && <Button fullWidth variant="contained" onClick={testHyperSku} disabled={testing} startIcon={testing ? <CircularProgress size={17} color="inherit" /> : <LocalShippingOutlinedIcon />} sx={{ borderRadius: 2, textTransform: "none", fontWeight: 750 }}>{testing ? "Testing..." : "Test API"}</Button>}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>;
          })}
        </Grid>
      )}

      <Dialog open={Boolean(editing)} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
        {editing && <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ pb: 1 }}><Typography sx={{ fontSize: 21, fontWeight: 850, color: "#0f172a" }}>Edit {editing.title}</Typography><Typography sx={{ mt: 0.5, color: "#64748b", fontSize: 13 }}>{targetLabel(editing.target)} · Leave secret fields blank to keep their current value.</Typography></DialogTitle>
          <DialogContent dividers><Stack spacing={2} sx={{ pt: 0.5 }}>{editing.fields.map((field) => {
            if (field.type === "boolean") return <TextField key={field.key} select fullWidth label={field.label} value={drafts[field.key] ?? ""} onChange={(event) => updateDraft(field.key, event.target.value)} helperText={`${field.key} · leave unset to use the application default`} disabled={saving}><MenuItem value=""><em>Unset / application default</em></MenuItem><MenuItem value="true">true</MenuItem><MenuItem value="false">false</MenuItem></TextField>;
            const isVisible = Boolean(visible[field.key]);
            return <Box key={field.key}><TextField fullWidth label={field.label} type={field.type === "secret" && !isVisible ? "password" : field.type === "number" ? "number" : "text"} value={drafts[field.key] ?? ""} onChange={(event) => updateDraft(field.key, event.target.value)} placeholder={field.type === "secret" ? (field.configured ? "Enter a new value or leave blank" : "Enter value") : ""} helperText={`${field.key}${field.type === "secret" ? " · secret is masked" : ""}`} disabled={saving || clears[field.key]} multiline={field.key.includes("GREETING") || field.key.includes("FALLBACK") || field.key.includes("ERROR")} minRows={3} InputProps={field.type === "secret" ? { endAdornment: <InputAdornment position="end"><IconButton aria-label={isVisible ? `Hide ${field.label}` : `Show ${field.label}`} onClick={() => setVisible((current) => ({ ...current, [field.key]: !isVisible }))} edge="end" disabled={saving}>{isVisible ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}</IconButton></InputAdornment> } : undefined} />{field.type === "secret" && field.configured && <FormControlLabel control={<Checkbox size="small" checked={Boolean(clears[field.key])} onChange={(event) => { setClears((current) => ({ ...current, [field.key]: event.target.checked })); if (event.target.checked) setDrafts((current) => ({ ...current, [field.key]: "" })); }} disabled={saving} />} label={<Typography sx={{ fontSize: 12, color: "#64748b" }}>Clear existing value</Typography>} />}</Box>;
          })}</Stack></DialogContent>
          <DialogActions sx={{ p: 2 }}><Button onClick={() => setEditing(null)} disabled={saving} sx={{ textTransform: "none" }}>Cancel</Button><Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <EditOutlinedIcon />} sx={{ textTransform: "none", borderRadius: 2, fontWeight: 800 }}>{saving ? "Saving..." : "Save changes"}</Button></DialogActions>
        </Box>}
      </Dialog>
    </Box>
  );
}
