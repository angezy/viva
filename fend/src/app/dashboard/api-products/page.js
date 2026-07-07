"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"
const IMPORT_CARD_HEIGHT = 300
const IMPORT_THUMB_SIZE = 100
const IMPORT_ACTIONS_HEIGHT = 56

function formatDate(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

export default function ApiProductsPage() {
  const [pid, setPid] = useState("") // sku/pid input
  const [price, setPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState("")
  const [snack, setSnack] = useState("")
  const [ping, setPing] = useState({
    loading: true,
    ok: false,
    tokenPresent: false,
    tokenCached: false,
    tokenCooldownSeconds: 0,
  })
  const [preview, setPreview] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const valid = useMemo(() => {
    const trimmedPid = pid.trim()
    const trimmedPrice = String(price).trim()
    return trimmedPid.length > 0 && trimmedPrice.length > 0 && Number.isFinite(Number(trimmedPrice))
  }, [pid, price])

  async function runPing() {
    try {
      setPing((p) => ({ ...p, loading: true }))
      const res = await fetch(`${API_BASE_URL}/api/cj/ping`)
      const data = await res.json()
      setPing({
        loading: false,
        ok: !!data.ok,
        tokenPresent: !!data.tokenPresent,
        tokenCached: !!data.tokenCached,
        tokenCooldownSeconds: Number(data.tokenCooldownSeconds || 0),
      })
    } catch (err) {
      setPing({ loading: false, ok: false, tokenPresent: false, tokenCached: false, tokenCooldownSeconds: 0 })
    }
  }

  async function loadRows() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/api/cj/products`)
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setError("")
    } catch (err) {
      console.error("Failed to load CJ products", err)
      setError("Unable to load imported products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runPing()
    loadRows()
  }, [])

  async function handleLookup(event) {
    if (event) event.preventDefault()
    if (!pid.trim()) return
    setLookupLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/api/cj/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: pid.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          const wait = data?.retryAfterSeconds ? ` Try again in ${data.retryAfterSeconds}s.` : ""
          throw new Error((data?.error || "Rate limited.") + wait)
        }
        throw new Error(data?.error || "Lookup failed")
      }
      setPreview(data.product || null)
      setSnack(`Fetched details for ${pid.trim()}`)
    } catch (err) {
      setPreview(null)
      setError(err.message || "Unable to fetch product")
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/cj/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: pid.trim(), price }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          const wait = data?.retryAfterSeconds ? ` Try again in ${data.retryAfterSeconds}s.` : ""
          throw new Error((data?.error || "Rate limited.") + wait)
        }
        throw new Error(data?.error || "Import failed")
      }
      setSnack(`Imported product ${pid.trim()}`)
      setPid("")
      setPrice("")
      await loadRows()
    } catch (err) {
      setError(err.message || "Unable to import product")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(importPid) {
    if (!importPid) return
    if (!confirm(`Delete imported product ${importPid}? This will remove it from your Products table.`)) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE_URL}/api/cj/import/${encodeURIComponent(importPid)}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Delete failed")
      }
      setSnack(`Deleted import ${importPid}`)
      await loadRows()
    } catch (err) {
      setError(err.message || "Unable to delete import")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, background: "#f8fafc", minHeight: "100vh" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Manage API Products (CJ Dropshipping)
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color={ping.ok ? "success.main" : "error.main"}>
            {ping.loading
              ? "Checking..."
              : !ping.tokenPresent
              ? "CJ API key missing"
              : ping.tokenCooldownSeconds > 0
              ? `Rate limited (${ping.tokenCooldownSeconds}s)`
              : ping.tokenCached
              ? "CJ token ready"
              : ping.ok
              ? "Config ok"
              : "Not configured"}
          </Typography>
          <Button size="small" variant="outlined" onClick={runPing} disabled={ping.loading}>
            Check
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Enter a CJ SKU (or PID) and set the selling price. You can fetch details first, then import to save.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardHeader title="Import product by SKU" subheader="Enter a CJ SKU (or PID) to fetch and import." />
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <TextField
                  label="SKU (or PID)"
                  value={pid}
                  onChange={(e) => setPid(e.target.value)}
                  fullWidth
                  required
                  placeholder="e.g. CJJJCWGY01212-Black"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleLookup()
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  fullWidth
                  required
                  type="number"
                  inputProps={{ step: "0.01", min: "0" }}
                  placeholder="e.g. 19.99"
                />
              </Grid>
              <Grid item xs={12} md={4} alignSelf="center">
                <Stack direction="row" spacing={1} sx={{ mt: { xs: 1, md: 0 } }}>
                  <Button
                    variant="outlined"
                    type="button"
                    onClick={handleLookup}
                    disabled={!pid.trim() || lookupLoading}
                  >
                    {lookupLoading ? "Fetching..." : "Fetch Details"}
                  </Button>
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={!valid || submitting}
                    sx={{ minWidth: 180 }}
                  >
                    {submitting ? "Importing..." : "Import & Save"}
                  </Button>
                  <Button variant="outlined" type="button" onClick={loadRows} disabled={loading}>
                    Refresh
                  </Button>
                </Stack>
              </Grid>
            </Grid>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
            {preview && (
              <Card variant="outlined" sx={{ mt: 2 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Box
                        sx={{
                          width: "100%",
                          height: 180,
                          background: `url(${preview.image}) center/cover`,
                          borderRadius: 2,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {preview.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {preview.description || "No description"}
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                        <Typography variant="body2">Category: {preview.category}</Typography>
                        <Typography variant="body2">Brand: {preview.brand}</Typography>
                        <Typography variant="body2">Stock: {preview.stock}</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 700 }}>
                        Source price: {preview.priceText ? preview.priceText : Number(preview.price || 0).toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Imported products"
          subheader={loading ? "Loading..." : `${rows.length} item(s)`}
        />
        <Divider />
        <CardContent>
          {rows.length === 0 && !loading ? (
            <Typography variant="body2" color="text.secondary">
              No imported products yet. Add one using the PID form above.
            </Typography>
          ) : loading ? (
            <Stack spacing={2}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} variant="outlined" sx={{ height: IMPORT_CARD_HEIGHT, width: "100%" }}>
                  <CardContent sx={{ height: "100%" }}>
                    <Box
                      sx={{
                        height: "100%",
                        display: "grid",
                        gridTemplateColumns: `${IMPORT_THUMB_SIZE}px 1fr 120px`,
                        gridTemplateRows: "auto 1fr auto",
                        gap: 2,
                        alignItems: "start",
                      }}
                    >
                      <Skeleton variant="rounded" width={IMPORT_THUMB_SIZE} height={IMPORT_THUMB_SIZE} />
                      <Box sx={{ minWidth: 0 }}>
                        <Skeleton width="80%" height={26} />
                        <Skeleton width="55%" />
                        <Skeleton width="70%" />
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Skeleton width={70} height={26} />
                      </Box>

                      <Box sx={{ gridColumn: "1 / -1", minHeight: 0, overflow: "hidden" }}>
                        <Skeleton sx={{ mt: 1 }} />
                        <Skeleton width="80%" />
                      </Box>

                      <Box sx={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Skeleton variant="rounded" width={90} height={32} />
                        <Skeleton width={140} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {rows.map((row) => (
                <Card key={row.pid} variant="outlined" sx={{ height: "300px", width: "500px", overflow: "hidden" }}>
                  <CardContent sx={{ height: "100%" }}>
                    <Box
                      sx={{
                        height: "100%",
                        display: "grid",
                        gridTemplateColumns: `${IMPORT_THUMB_SIZE}px 1fr 120px`,
                        gridTemplateRows: "auto 1fr auto",
                        gap: 2,
                        alignItems: "start",
                      }}
                    >
                      <Box
                        sx={{
                          width: IMPORT_THUMB_SIZE,
                          height: IMPORT_THUMB_SIZE,
                          borderRadius: 3,
                          border: "1px solid rgba(15,23,42,0.12)",
                          background: `url(${row.img || "https://picsum.photos/seed/cj-import/200/200"}) center/cover`,
                        }}
                        aria-label={row.name || row.pid}
                      />

                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 800,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: "22px",
                            maxHeight: 44,
                          }}
                        >
                          {row.name || `CJ Product ${row.pid}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          PID: {row.pid} • Product ID: {row.productId ?? "n/a"}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            wordBreak: "break-all",
                          }}
                        >
                          Image path: {row.img ?? "n/a"}
                        </Typography>
                      </Box>

                      <Typography variant="subtitle1" color="primary" sx={{ textAlign: "right", fontWeight: 800 }}>
                        ${Number(row.price || 0).toFixed(2)}
                      </Typography>

                      <Box sx={{ gridColumn: "1 / -1", minHeight: 0, overflow: "hidden" }}>
                        {row.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              lineHeight: "20px",
                              maxHeight: 60,
                            }}
                          >
                            {row.description}
                          </Typography>
                        )}
                      </Box>

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          gridColumn: "1 / -1",
                          alignItems: "center",
                          justifyContent: "space-between",
                          minHeight: IMPORT_ACTIONS_HEIGHT,
                        }}
                      >
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          type="button"
                          disabled={submitting}
                          onClick={() => handleDelete(row.pid)}
                        >
                          Delete
                        </Button>
                        {row.updatedAt && (
                          <Typography variant="caption" color="text.secondary">
                            Updated: {formatDate(row.updatedAt)}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        message={snack}
        onClose={() => setSnack("")}
      />
    </Box>
  )
}
