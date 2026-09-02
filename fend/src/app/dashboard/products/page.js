"use client"

import React, { useEffect, useState } from "react"
import Grid from "@mui/material/Grid"
import Card from "@mui/material/Card"
import CardActions from "@mui/material/CardActions"
import CardContent from "@mui/material/CardContent"
import Skeleton from "@mui/material/Skeleton"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import IconButton from "@mui/material/IconButton"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"
import Checkbox from "@mui/material/Checkbox"
import FormControlLabel from "@mui/material/FormControlLabel"
import Box from "@mui/material/Box"
import Snackbar from "@mui/material/Snackbar"
import Tooltip from "@mui/material/Tooltip"
import Stack from "@mui/material/Stack"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import AddIcon from "@mui/icons-material/Add"

const API_BASE_URL = ""
const FALLBACK_IMAGE = "https://picsum.photos/seed/fallback/600/400"
const CARD_HEIGHT = 360
const CARD_THUMB_SIZE = 100
const CARD_ACTIONS_HEIGHT = 56
const THUMB_SIZE = 44


const formatPrice = (value) => {
  const num = Number(value)
  if (Number.isFinite(num)) {
    return num.toFixed(2)
  }
  return typeof value === "string" && value.trim().length > 0 ? value : "0.00"
}

const normalizeProduct = (product, index = 0) => {
  if (!product) return null
  const fallbackId = product.id ?? product.PID ?? product.pid ?? product.ProductId ?? `p-${Date.now()}-${index}`
  const rawSalePrice = product.salePrice ?? product.salesPrice ?? product.SellingPrice ?? product.price ?? product.Price ?? 0
  const rawBuyPrice = product.buyPrice ?? product.costPrice ?? product.CostPrice ?? product.BuyPrice ?? product.cost ?? product.Cost ?? 0
  const rawStock = product.stock ?? product.Stock ?? product.quantity ?? product.Quantity
  const salePrice = typeof rawSalePrice === "number" ? rawSalePrice : parseFloat(rawSalePrice) || 0
  const buyPrice = typeof rawBuyPrice === "number" ? rawBuyPrice : parseFloat(rawBuyPrice) || 0
  const stock = typeof rawStock === "number" ? rawStock : parseInt(rawStock, 10) || 0
  const unitProfit = salePrice - buyPrice

  return {
    id: String(fallbackId),
    title: product.title ?? product.name ?? product.Name ?? "Untitled Product",
    description: product.description ?? product.Description ?? "",
    image:
      (Array.isArray(product.images) && product.images.length ? product.images[0] : null) ??
      product.image ??
      product.img ??
      product.Img ??
      product.IMG ??
      FALLBACK_IMAGE,
    price: salePrice,
    salePrice,
    buyPrice,
    unitProfit,
    marginPercent: salePrice > 0 ? (unitProfit / salePrice) * 100 : 0,
    inventoryProfit: unitProfit * stock,
    stock,
    currency: product.currency ?? product.Currency ?? "USD",
    isTrending: Boolean(product.isTrending ?? product.IsTrending ?? product.trending ?? product.Trending),
    category: product.category ?? product.Category ?? "General",
    brand: product.brand ?? product.Brand ?? "Generic",
    address: product.address ?? product.Address ?? "",
    images: Array.isArray(product.images)
      ? product.images
          .filter((img) => typeof img === "string")
          .map((img) => img.trim())
          .filter(Boolean)
      : [],
  }
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [snack, setSnack] = useState({ open: false, message: "" })
  const [saving, setSaving] = useState(false)
  const [galleryFiles, setGalleryFiles] = useState([])
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE_URL}/api/products`)
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        const data = await response.json()
        const normalized = Array.isArray(data) ? data.map((item, index) => normalizeProduct(item, index)).filter(Boolean) : []
        if (isMounted) {
          setProducts(normalized)
          setError("")
        }
      } catch (err) {
        console.error("Failed to load products:", err)
        if (isMounted) {
          setProducts([])
          setError("Unable to load live products. Try again after the backend is available.")
          setSnack({ open: true, message: "Unable to load products" })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      isMounted = false
    }
  }, [])

  function handleOpenNew() {
    setCurrent({
      id: "new-product",
      title: "",
      sku: "",
      description: "",
      image: FALLBACK_IMAGE,
      price: 0,
      salePrice: 0,
      buyPrice: 0,
      unitProfit: 0,
      marginPercent: 0,
      isTrending: false,
      stock: 0,
      category: "General",
      brand: "Generic",
      address: "",
      images: [],
    })
    resetGalleryInput()
    setEditOpen(true)
  }

  function handleEdit(p) {
    setCurrent({ ...p })
    resetGalleryInput()
    setEditOpen(true)
  }

  function resetGalleryInput() {
    setGalleryFiles([])
    setFileInputKey((prev) => prev + 1)
  }

  function handleGalleryChange(event) {
    const files = event.target.files ? Array.from(event.target.files) : []
    setGalleryFiles(files)
  }

  function handleDialogClose() {
    setEditOpen(false)
    resetGalleryInput()
  }

  async function handleDelete(id) {
    if (!confirm("Delete this product? This cannot be undone.")) return
    const numericId = Number(id)
    try {
      if (Number.isFinite(numericId)) {
        const response = await fetch(`${API_BASE_URL}/api/products/${numericId}`, { method: "DELETE" })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || `Unable to delete product (status ${response.status})`)
        }
      }
      setProducts((prev) => prev.filter((p) => p.id !== id))
      setSnack({ open: true, message: "Product deleted" })
    } catch (err) {
      console.error("Failed to delete product:", err)
      const message = err instanceof Error ? err.message : "Failed to delete product"
      setSnack({ open: true, message })
    }
  }

  async function handleSave() {
    if (!current) return
    const sanitized = {
      ...current,
      salePrice: typeof current.salePrice === "number" ? current.salePrice : parseFloat(current.salePrice ?? current.price) || 0,
      buyPrice: typeof current.buyPrice === "number" ? current.buyPrice : parseFloat(current.buyPrice) || 0,
      stock: typeof current.stock === "number" ? current.stock : parseInt(current.stock, 10) || 0,
      category: current.category && current.category.trim().length > 0 ? current.category : "General",
      brand: current.brand && current.brand.trim().length > 0 ? current.brand : "Generic",
      address: current.address && current.address.trim().length > 0 ? current.address.trim() : "",
    }
    sanitized.price = sanitized.salePrice
    sanitized.unitProfit = sanitized.salePrice - sanitized.buyPrice
    sanitized.marginPercent = sanitized.salePrice > 0 ? (sanitized.unitProfit / sanitized.salePrice) * 100 : 0
    const numericId = Number(sanitized.id)
    const isExisting = Number.isFinite(numericId)
    try {
      setSaving(true)
      const formData = new FormData()
      if (isExisting) {
        formData.append("id", String(numericId))
      }
      formData.append("title", sanitized.title)
      formData.append("name", sanitized.title)
      formData.append("sku", sanitized.sku || "")
      formData.append("description", sanitized.description || "")
      formData.append("price", String(sanitized.salePrice))
      formData.append("salePrice", String(sanitized.salePrice))
      formData.append("buyPrice", String(sanitized.buyPrice))
      formData.append("currency", String(sanitized.currency || "USD"))
      formData.append("isTrending", String(Boolean(sanitized.isTrending)))
      formData.append("image", sanitized.image || "")
      formData.append("stock", String(sanitized.stock))
      formData.append("category", sanitized.category)
      formData.append("brand", sanitized.brand)
      formData.append("address", sanitized.address)
      formData.append("existingImages", JSON.stringify(Array.isArray(current.images) ? current.images : []))
      galleryFiles.forEach((file) => {
        formData.append("gallery", file)
      })

      const response = await fetch(isExisting ? `${API_BASE_URL}/api/products/${numericId}` : `${API_BASE_URL}/api/products`, {
        method: isExisting ? "PUT" : "POST",
        body: formData,
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const errMessage = (payload && payload.error) || `Unable to save product (status ${response.status})`
        throw new Error(errMessage)
      }

      const serverProduct = payload && (payload.product || payload)
      const normalized = normalizeProduct(serverProduct)
      if (!normalized) {
        throw new Error("Server returned an invalid product payload")
      }

      setProducts((prev) => {
        if (isExisting) {
          return prev.map((p) => (p.id === sanitized.id || p.id === String(normalized.id) ? normalized : p))
        }
        return [normalized, ...prev]
      })
      handleDialogClose()
      setSnack({ open: true, message: "Product saved" })
    } catch (err) {
      console.error("Failed to save product:", err)
      const message = err instanceof Error ? err.message : "Failed to save product"
      setSnack({ open: true, message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ padding: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Product Manager
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your products and edit details, update images, or delete items.
          </Typography>
        </Box>
        <Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
            Add Product
          </Button>
        </Box>
      </Stack>

      {loading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 9 }).map((_, idx) => (
            <Grid
              key={idx}
              sx={{ display: "flex" }}
              size={{
                xs: 12,
                sm: 6,
                md: 4
              }}>
              <Card sx={{ height: CARD_HEIGHT, width: "300px", maxWidth: "100%", display: "flex", flexDirection: "column", borderRadius: 4 }}>
                <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Skeleton variant="rounded" width={CARD_THUMB_SIZE} height={CARD_THUMB_SIZE} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="75%" height={24} />
                      <Skeleton width="40%" height={18} />
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Skeleton variant="rounded" width={70} height={22} />
                        <Skeleton variant="rounded" width={80} height={22} />
                      </Stack>
                    </Box>
                  </Stack>
                  <Skeleton width="95%" />
                  <Skeleton width="85%" />
                  <Stack direction="row" spacing={2}>
                    <Skeleton width={70} />
                    <Skeleton width={90} />
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: "flex-end", mt: "auto" }}>
                  <Skeleton variant="circular" width={34} height={34} />
                  <Skeleton variant="circular" width={34} height={34} />
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {products.length === 0 ? (
            <Grid size={12}>
              <Typography color="text.secondary">No products found.</Typography>
            </Grid>
          ) : (
            products.map((p) => (
              <Grid
                key={p.id}
                sx={{ display: "flex" }}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4
                }}>
                <Card sx={{ height: `${CARD_HEIGHT}px`, width: "300px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <CardContent sx={{ flexGrow: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 1 }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box
                        sx={{
                          width: CARD_THUMB_SIZE,
                          height: CARD_THUMB_SIZE,
                          borderRadius: 3,
                          border: "1px solid rgba(15,23,42,0.12)",
                          background: `url(${p.image || FALLBACK_IMAGE}) center/cover`,
                          flexShrink: 0,
                        }}
                        aria-label={p.title}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: "22px",
                            maxHeight: 44,
                          }}
                        >
                          {p.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {p.id}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                          <Typography variant="caption" sx={{ px: 1, py: 0.25, border: "1px solid rgba(15,23,42,0.16)", borderRadius: 999 }}>
                            {p.category || "General"}
                          </Typography>
                          {p.isTrending && (
                            <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: 999, backgroundColor: "var(--color-primary)", color: "#fff" }}>
                              Trending
                            </Typography>
                          )}
                          <Typography variant="caption" sx={{ px: 1, py: 0.25, border: "1px solid rgba(15,23,42,0.16)", borderRadius: 999 }}>
                            {p.brand || "Generic"}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.description || "No description available."}
                    </Typography>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={2} alignItems="baseline">
                        <Typography variant="body1" fontWeight={700}>
                          Sale: ${formatPrice(p.salePrice)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Buy: ${formatPrice(p.buyPrice)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={2}>
                        <Typography variant="body2" color={p.unitProfit >= 0 ? "success.main" : "error.main"} fontWeight={600}>
                          Profit: ${formatPrice(p.unitProfit)} ({formatPrice(p.marginPercent)}%)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Stock: {Number.isFinite(p.stock) ? p.stock : 0}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Inventory profit potential: ${formatPrice(p.inventoryProfit)}
                      </Typography>
                    </Stack>
                    {Array.isArray(p.images) && p.images.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {p.images.length} gallery photo{p.images.length > 1 ? "s" : ""}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ justifyContent: "flex-end", mt: "auto", height: CARD_ACTIONS_HEIGHT }}>
                    <Tooltip title="Edit">
                      <IconButton color="primary" aria-label={`Edit ${p.title}`} onClick={() => handleEdit(p)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" aria-label={`Delete ${p.title}`} onClick={() => handleDelete(p.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {!loading && error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      <Dialog open={editOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>{current && products.find((x) => x.id === current.id) ? "Edit Product" : "Add Product"}</DialogTitle>
        <DialogContent>
          {current && (
            <Box sx={{ mt: 1, display: "grid", gap: 2 }}>
              <TextField label="Product ID" value={current.id} fullWidth onChange={(e) => setCurrent({ ...current, id: e.target.value })} />
              <TextField label="Title" value={current.title} fullWidth onChange={(e) => setCurrent({ ...current, title: e.target.value })} />
              <TextField label="SKU" value={current.sku ?? ""} fullWidth onChange={(e) => setCurrent({ ...current, sku: e.target.value })} helperText="Unique product identifier for inventory and accounting" />
              <TextField label="Category" value={current.category ?? ""} fullWidth onChange={(e) => setCurrent({ ...current, category: e.target.value })} />
              <TextField label="Brand" value={current.brand ?? ""} fullWidth onChange={(e) => setCurrent({ ...current, brand: e.target.value })} />
              <TextField label="Description" value={current.description} fullWidth multiline minRows={3} onChange={(e) => setCurrent({ ...current, description: e.target.value })} />
              <TextField label="Image URL" value={current.image} fullWidth onChange={(e) => setCurrent({ ...current, image: e.target.value })} />
              <TextField label="Address" value={current.address ?? ""} fullWidth onChange={(e) => setCurrent({ ...current, address: e.target.value })} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Sales price"
                  type="number"
                  value={current.salePrice ?? current.price ?? 0}
                  fullWidth
                  required
                  onChange={(e) => setCurrent({ ...current, salePrice: e.target.value, price: e.target.value })}
                  inputProps={{ min: 0, step: "0.01" }}
                  helperText="Customer-facing price"
                />
                <TextField
                  label="Buy price / cost"
                  type="number"
                  value={current.buyPrice ?? 0}
                  fullWidth
                  required
                  onChange={(e) => setCurrent({ ...current, buyPrice: e.target.value })}
                  inputProps={{ min: 0, step: "0.01" }}
                  helperText="Supplier or landed unit cost"
                />
              </Stack>
              <TextField
                label="Currency"
                value={current.currency ?? "USD"}
                inputProps={{ maxLength: 3 }}
                onChange={(e) => setCurrent({ ...current, currency: e.target.value.toUpperCase().slice(0, 3) })}
              />
              <FormControlLabel
                control={<Checkbox checked={Boolean(current.isTrending)} onChange={(e) => setCurrent({ ...current, isTrending: e.target.checked })} />}
                label="Show in Trending collection"
              />
              <TextField
                label="Stock"
                type="number"
                value={current.stock ?? 0}
                fullWidth
                onChange={(e) => {
                  const value = e.target.value
                  setCurrent({ ...current, stock: value === "" ? "" : Number(value) })
                }}
                inputProps={{ min: 0 }}
              />
              <Stack spacing={1}>
                <Button component="label" variant="outlined">
                  Upload Gallery Photos
                  <input key={fileInputKey} hidden type="file" accept="image/*" multiple onChange={handleGalleryChange} />
                </Button>
                {galleryFiles.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {galleryFiles.length} new file(s) selected
                  </Typography>
                )}
                {Array.isArray(current.images) && current.images.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Existing photos:
                    </Typography>
                    <Stack spacing={0.5} sx={{ maxHeight: 140, overflowY: "auto" }}>
                      {current.images.map((img, idx) => (
                        <Typography key={`${img}-${idx}`} variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                          {img}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ open: false, message: "" })} message={snack.message} />
    </Box>
  );
}
