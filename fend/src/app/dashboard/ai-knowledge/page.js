"use client";

import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const EMPTY_ENTRY = { id: "", category: "faq", title: "", content: "", keywords: [], enabled: true };

function entryLabel(category) {
  return category === "product_guidance" ? "Product guidance" : category === "policy" ? "Policy" : "FAQ";
}

export default function AIKnowledgePage() {
  const [knowledge, setKnowledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/ai-knowledge", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load AI knowledge");
        return data;
      })
      .then((data) => { if (active) setKnowledge(data); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateEntry(index, patch) {
    setKnowledge((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry),
    }));
  }

  async function save() {
    if (!knowledge || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/ai-knowledge", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(knowledge),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save AI knowledge");
      setKnowledge(data.knowledge);
      setNotice("AI knowledge saved");
    } catch (saveError) {
      setError(saveError.message || "Unable to save AI knowledge");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Box sx={{ p: 3 }}><Typography>Loading AI knowledge…</Typography></Box>;
  if (!knowledge) return <Box sx={{ p: 3 }}><Alert severity="error">{error || "AI knowledge is unavailable."}</Alert></Box>;

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 800, letterSpacing: "0.14em" }}>GROUNDED CUSTOMER SUPPORT</Typography>
            <Typography component="h1" sx={{ fontWeight: 850, fontSize: { xs: "2.2rem", md: "3.25rem" }, letterSpacing: "-0.05em", lineHeight: 1 }}>AI knowledge</Typography>
            <Typography sx={{ color: "text.secondary", mt: 1, maxWidth: 760 }}>Only enabled entries are available to the customer assistant. It will use live product and inventory data, plus these approved FAQs, policies, and product guides. Questions without a clear source are sent to support.</Typography>
          </Box>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={save} disabled={saving} sx={{ alignSelf: "flex-start", borderRadius: 999, textTransform: "none", fontWeight: 800 }}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 3 }}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>First greeting</Typography>
          <TextField fullWidth multiline minRows={2} value={knowledge.greeting || ""} onChange={(event) => setKnowledge((current) => ({ ...current, greeting: event.target.value }))} helperText="Shown when a customer opens the support popup." />
        </Paper>

        <Stack spacing={2}>
          {knowledge.entries.map((entry, index) => (
            <Paper key={entry.id || index} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 800 }}>{entryLabel(entry.category)} entry {index + 1}</Typography>
                <Stack direction="row" alignItems="center" gap={1}>
                  <FormControlLabel control={<Checkbox checked={entry.enabled !== false} onChange={(event) => updateEntry(index, { enabled: event.target.checked })} />} label="Enabled" />
                  <Button color="error" size="small" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setKnowledge((current) => ({ ...current, entries: current.entries.filter((_, entryIndex) => entryIndex !== index) }))} sx={{ textTransform: "none" }}>Remove</Button>
                </Stack>
              </Stack>
              <Stack spacing={1.5}>
                <Select value={entry.category} onChange={(event) => updateEntry(index, { category: event.target.value })} size="small" sx={{ maxWidth: 220 }}>
                  <MenuItem value="faq">FAQ</MenuItem>
                  <MenuItem value="policy">Policy</MenuItem>
                  <MenuItem value="product_guidance">Product guidance</MenuItem>
                </Select>
                <TextField label="Title or customer question" value={entry.title} onChange={(event) => updateEntry(index, { title: event.target.value })} fullWidth />
                <TextField label="Approved answer" value={entry.content} onChange={(event) => updateEntry(index, { content: event.target.value })} multiline minRows={4} fullWidth helperText="The assistant returns this approved text. Do not include estimates or claims you cannot support." />
                <TextField label="Search keywords" value={(entry.keywords || []).join(", ")} onChange={(event) => updateEntry(index, { keywords: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} fullWidth helperText="Optional, comma-separated terms that help match a question." />
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setKnowledge((current) => ({ ...current, entries: [...current.entries, { ...EMPTY_ENTRY }] }))} sx={{ mt: 2, borderRadius: 999, textTransform: "none", fontWeight: 800 }}>Add approved entry</Button>
        <Snackbar open={Boolean(notice)} autoHideDuration={2600} message={notice} onClose={() => setNotice("")} />
      </Container>
    </Box>
  );
}
