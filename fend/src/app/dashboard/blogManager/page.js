"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
  Chip,
  Divider,
  IconButton,
  Snackbar,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
const Editor = dynamic(() => import("@tinymce/tinymce-react").then((mod) => mod.Editor), { ssr: false });

const EMPTY_POST = {
  id: "",
  title: "",
  excerpt: "",
  author: "",
  date: "",
  image: "",
  alt: "",
  tags: [],
  slug: "",
  body: "",
};

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `post-${Math.random().toString(16).slice(2)}`;

const THUMB_SIZE = 100;
const FALLBACK_THUMB = "https://picsum.photos/seed/blog-thumb/200/200";
const BLOG_CARD_HEIGHT = 300;
const BLOG_ACTIONS_HEIGHT = 64;

function toSlug(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function BlogManager() {
  const tinymceKey = process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key";
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
  const [current, setCurrent] = useState(EMPTY_POST);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/blog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setContent(data);
        if (data.posts?.length) setCurrent({ ...data.posts[0] });
      })
      .catch(() => setError("Failed to load blog content"))
      .finally(() => setLoading(false));
  }, []);

  const updatePostField = (field, value) => {
    setCurrent((prev) => {
      const next = { ...(prev || {}), [field]: value };
      if (field === "title" && autoSlug && (!prev?.slug || prev.slug === toSlug(prev.title))) {
        next.slug = toSlug(value);
      }
      return next;
    });
  };

  const upsertPost = () => {
    if (!current.title || !current.slug) {
      setError("Title and slug are required.");
      return;
    }
    setError("");
    const posts = Array.isArray(content?.posts) ? [...content.posts] : [];
    const idx = posts.findIndex((p) => p.id === current.id);
    const postWithId = { ...current, id: current.id || genId() };
    if (idx >= 0) {
      posts[idx] = postWithId;
    } else {
      posts.unshift(postWithId);
    }
    setContent((prev) => ({ ...(prev || {}), posts }));
    setHasLocalChanges(true);
    setToast({ open: true, severity: "success", message: "Saved locally. Click Save All to persist." });
    setEditorOpen(false);
  };

  const deletePost = (id) => {
    if (!id) return;
    const posts = (content?.posts || []).filter((p) => p.id !== id);
    setContent((prev) => ({ ...(prev || {}), posts }));
    setCurrent(EMPTY_POST);
    setHasLocalChanges(true);
    setToast({ open: true, severity: "info", message: "Removed locally. Click Save All to persist." });
  };

  const handleSaveAll = async () => {
    if (!content) return;
    setSaving(true);
    setError("");
    setToast({ open: false, severity: "success", message: "" });
    try {
      const res = await fetch("/api/dashboard/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("save");
      setHasLocalChanges(false);
      setToast({ open: true, severity: "success", message: "Saved to blog.json." });
    } catch (err) {
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (post = EMPTY_POST) => {
    setCurrent({ ...post });
    setAutoSlug(!post.slug);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setCurrent(EMPTY_POST);
  };
  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", background: "#f8fafc" }}>
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={220} height={34} />
              <Skeleton variant="text" width={360} height={22} />
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignSelf: { md: "center" } }}>
              <Skeleton variant="rounded" width={320} height={40} />
              <Skeleton variant="rounded" width={130} height={40} />
              <Skeleton variant="rounded" width={130} height={40} />
            </Stack>
          </Stack>

          <Grid container spacing={2.5}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <Grid
                key={idx}
                sx={{ display: "flex" }}
                size={{
                  xs: 12,
                  sm: 6,
                  md: 4,
                  lg: 3
                }}>
                <Card sx={{ height: BLOG_CARD_HEIGHT, width: "100%", borderRadius: 4, overflow: "hidden" }}>
                  <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Skeleton variant="rounded" width={THUMB_SIZE} height={THUMB_SIZE} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Skeleton variant="text" width="85%" height={26} />
                        <Skeleton variant="text" width="60%" height={18} />
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Skeleton variant="rounded" width={60} height={24} />
                          <Skeleton variant="rounded" width={60} height={24} />
                        </Stack>
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 2 }}>
                      <Skeleton variant="text" width="95%" />
                      <Skeleton variant="text" width="90%" />
                      <Skeleton variant="text" width="70%" />
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
                      <Skeleton variant="rounded" width={100} height={32} />
                      <Skeleton variant="rounded" width={110} height={32} />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    );
  }
  if (!content) return <div style={{ padding: 16, color: "#b00" }}>{error || "No content loaded."}</div>;

  const posts = content.posts || [];
  const filtered = posts
    .filter((post) => {
      if (!query.trim()) return true;
      const hay = `${post.title || ""} ${post.excerpt || ""} ${(post.tags || []).join(" ")} ${post.slug || ""}`.toLowerCase();
      return hay.includes(query.trim().toLowerCase());
    })
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  return (
    <Box sx={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Blog Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create, edit, and publish posts. Changes are local until you click Save All.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              size="small"
              placeholder="Search posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ width: { xs: "100%", sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => openEditor(EMPTY_POST)}
              sx={{ whiteSpace: "nowrap" }}
            >
              New Post
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={handleSaveAll}
              disabled={saving || !hasLocalChanges}
              sx={{ whiteSpace: "nowrap" }}
            >
              {saving ? "Saving..." : "Save All"}
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
          <Chip label={`${posts.length} post(s)`} />
          <Chip
            label={hasLocalChanges ? "Unsaved changes" : "All changes saved"}
            color={hasLocalChanges ? "warning" : "success"}
            variant="outlined"
          />
          {error && <Chip label={error} color="error" variant="outlined" />}
        </Stack>

        {filtered.length === 0 ? (
          <Card sx={{ borderRadius: 4, border: "1px dashed rgba(15,23,42,0.2)" }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800}>
                No posts found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Try a different search, or create a new post.
              </Typography>
              <Button sx={{ mt: 2 }} variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openEditor(EMPTY_POST)}>
                Create Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2.5}>
            {filtered.map((post) => {
              const tags = Array.isArray(post.tags) ? post.tags : [];
              const visibleTags = tags.slice(0, 3);
              const extraTagCount = Math.max(0, tags.length - visibleTags.length);
              const href = post.slug ? `/blog/${post.slug}` : null;

              return (
                <Grid
                  key={post.id}
                  sx={{ display: "flex" }}
                  size={{
                    xs: 12,
                    sm: 6,
                    md: 4,
                    lg: 3
                  }}>
                  <Card
                    sx={{
                      width: "300px",
                      height: "300px",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      borderRadius: 4,
                      border: "1px solid rgba(15,23,42,0.12)",
                      transition: "transform 120ms ease, box-shadow 120ms ease",
                      "&:hover": { transform: "translateY(-2px)", boxShadow: "0 18px 40px rgba(2,6,23,0.10)" },
                    }}
                  >
                    <CardContent sx={{ pb: 1.5, flex: 1, minHeight: 0, overflow: "hidden" }}>
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Box
                          sx={{
                            width: THUMB_SIZE,
                            height: THUMB_SIZE,
                            borderRadius: 3,
                            border: "1px solid rgba(15,23,42,0.12)",
                            background: `url(${post.image || FALLBACK_THUMB}) center/cover`,
                            flexShrink: 0,
                          }}
                          aria-label={post.alt || post.title || "Post image"}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={800}
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              lineHeight: "22px",
                              maxHeight: 44,
                            }}
                          >
                            {post.title || "Untitled"}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {post.author ? `By ${post.author}` : "Author not set"} {post.date ? `• ${post.date}` : ""}
                          </Typography>
                          <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: "wrap" }}>
                            {visibleTags.map((tag) => (
                              <Chip key={tag} label={tag} size="small" variant="outlined" />
                            ))}
                            {extraTagCount > 0 && <Chip label={`+${extraTagCount}`} size="small" />}
                          </Stack>
                        </Box>
                      </Stack>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          lineHeight: "20px",
                          maxHeight: 60,
                          minHeight: 60,
                        }}
                      >
                        {post.excerpt || "No excerpt yet. Add a short summary to improve SEO and previews."}
                      </Typography>
                    </CardContent>
                    <CardActions
                      sx={{
                        px: 2,
                        pb: 2,
                        pt: 0,
                        justifyContent: "space-between",
                        mt: "auto",
                        height: BLOG_ACTIONS_HEIGHT,
                      }}
                    >
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Edit post">
                          <Button size="small" variant="contained" startIcon={<EditRoundedIcon />} onClick={() => openEditor(post)}>
                            Edit
                          </Button>
                        </Tooltip>
                        <Tooltip title="Delete post">
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteOutlineRoundedIcon />}
                            onClick={() => deletePost(post.id)}
                          >
                            Delete
                          </Button>
                        </Tooltip>
                      </Stack>
                      {href && (
                        <Tooltip title={href}>
                          <IconButton
                            size="small"
                            component="a"
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open post"
                          >
                            <LinkRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      <Dialog open={editorOpen} onClose={closeEditor} fullScreen={fullScreen} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={900}>
                {current.id ? "Edit Post" : "New Post"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Thumbnail is locked to {THUMB_SIZE}x{THUMB_SIZE}.
              </Typography>
            </Box>
            <IconButton onClick={closeEditor} size="small" aria-label="Close editor">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "#fbfdff" }}>
          <Grid container spacing={2}>
            <Grid
              size={{
                xs: 12,
                md: 8
              }}>
              <Stack spacing={2}>
                <TextField
                  label="Title"
                  value={current.title}
                  onChange={(e) => updatePostField("title", e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Slug/URL"
                  value={current.slug}
                  onChange={(e) => {
                    setAutoSlug(false);
                    updatePostField("slug", toSlug(e.target.value));
                  }}
                  helperText={current.slug ? `/blog/${current.slug}` : "Used in the URL. Example: my-first-post"}
                  fullWidth
                  required
                />

                <Grid container spacing={2}>
                  <Grid
                    size={{
                      xs: 12,
                      md: 6
                    }}>
                    <TextField label="Author" value={current.author} onChange={(e) => updatePostField("author", e.target.value)} fullWidth />
                  </Grid>
                  <Grid
                    size={{
                      xs: 12,
                      md: 6
                    }}>
                    <TextField
                      label="Date"
                      value={current.date}
                      onChange={(e) => updatePostField("date", e.target.value)}
                      fullWidth
                      placeholder="2025-12-17"
                    />
                  </Grid>
                </Grid>

                <TextField
                  label="Excerpt"
                  value={current.excerpt}
                  onChange={(e) => updatePostField("excerpt", e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
                <TextField
                  label="Tags (comma separated)"
                  value={(current.tags || []).join(",")}
                  onChange={(e) =>
                    updatePostField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    )
                  }
                  fullWidth
                />
              </Stack>
            </Grid>

            <Grid
              size={{
                xs: 12,
                md: 4
              }}>
              <Card sx={{ borderRadius: 4, border: "1px solid rgba(15,23,42,0.12)" }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                    Media
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      variant="rounded"
                      src={current.image || FALLBACK_THUMB}
                      alt={current.alt || current.title || "Post image"}
                      sx={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 3 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {current.title || "Untitled"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {current.slug ? `/blog/${current.slug}` : "Slug not set"}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField label="Image URL" value={current.image} onChange={(e) => updatePostField("image", e.target.value)} fullWidth />
                    <TextField label="Alt text" value={current.alt} onChange={(e) => updatePostField("alt", e.target.value)} fullWidth />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1 }}>
                Body
              </Typography>
              <Editor
                apiKey={tinymceKey}
                value={current.body}
                init={{
                  height: 360,
                  menubar: false,
                  plugins: ["link", "lists", "code", "image", "table", "media"],
                  toolbar:
                    "undo redo | formatselect | bold italic underline | bullist numlist | link image media | alignleft aligncenter alignright | code",
                  content_style: "body { font-family: Inter, sans-serif; font-size: 14px; }",
                }}
                onEditorChange={(val) => updatePostField("body", val)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {current.id ? (
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => {
                if (confirm("Delete this post?")) {
                  deletePost(current.id);
                  closeEditor();
                }
              }}
            >
              Delete
            </Button>
          ) : (
            <Box />
          )}
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={closeEditor}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={upsertPost}>
            Save Post
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
