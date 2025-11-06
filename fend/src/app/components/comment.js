"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  Skeleton,
  Avatar,
  IconButton,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

export default function CommentSection() {
  const [comments, setComments] = useState([]);
  const [form, setForm] = useState({ name: "", text: "" });
  const [email, setEmail] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch comments
  useEffect(() => {
    fetch("http://localhost:5000/api/comment")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const normalized = data.map((c) => {
            const img = c.img ?? c.Img ?? c.avatar ?? c.Avatar ?? null;
            let fullImg = null;
            if (img) {
              fullImg = /^https?:\/\//i.test(img)
                ? img
                : `http://localhost:5000/${img.replace(/^\//, "")}`;
            }
            return {
              id: c.id ?? c.CommentId ?? null,
              name: c.name ?? c.Name ?? "Anonymous",
              text: c.text ?? c.Text ?? "",
              createdAt: c.createdAt ?? c.CreatedAt ?? null,
              img: fullImg,
            };
          });
          setComments(normalized);
        } else {
          setComments([]);
        }
      })
      .catch((err) => console.error("Error fetching comments:", err))
      .finally(() => setLoading(false));
  }, []);

  // Handlers
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const handleEmailChange = (e) => setEmail(e.target.value);
  const handleFileChange = (e) => setFile(e.target.files[0] || null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.text.trim() || !email.trim()) {
      alert("Please provide name, email and comment text.");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("text", form.text);
      fd.append("email", email);
      if (file) fd.append("image", file);

      const res = await fetch("http://localhost:5000/api/comment", {
        method: "POST",
        body: fd,
      });

      const newComment = await res.json();
      setComments([...comments, newComment]);
      setForm({ name: "", text: "" });
      setEmail("");
      setFile(null);
    } catch (error) {
      console.error("Error posting comment:", error);
    }
  };

  return (
    <Box maxWidth="700px" mx="auto" mt={6} px={2}>
      <Typography variant="h4" gutterBottom fontWeight="bold" textAlign="center">
        💬 Comments
      </Typography>

      {/* Comment List */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
          boxShadow: 2,
          mb: 4,
          backgroundColor: "#fafafa",
        }}
      >
        <List>
          {loading ? (
            Array.from(new Array(3)).map((_, i) => (
              <React.Fragment key={i}>
                <ListItem>
                  <Skeleton
                    variant="circular"
                    width={40}
                    height={40}
                    sx={{ mr: 2 }}
                  />
                  <ListItemText
                    primary={<Skeleton variant="text" width={120} />}
                    secondary={<Skeleton variant="text" width="80%" />}
                  />
                </ListItem>
                {i < 2 && <Divider component="li" />}
              </React.Fragment>
            ))
          ) : comments.length === 0 ? (
            <Typography p={2} color="text.secondary" textAlign="center">
              No comments yet. Be the first!
            </Typography>
          ) : (
            comments.map((c, i) => (
              <React.Fragment key={i}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    transition: "background 0.3s",
                    "&:hover": { backgroundColor: "#f0f7ff" },
                    borderRadius: 2,
                  }}
                >
                  <Avatar
                    src={c.img}
                    alt={c.name}
                    sx={{ width: 45, height: 45, mr: 2 }}
                  >
                    {!c.img && c.name
                      ? c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")
                      : null}
                  </Avatar>
                  <ListItemText
                    primary={
                      <Typography fontWeight="bold">{c.name}</Typography>
                    }
                    secondary={
                      <>
                        {/* render as span to avoid nested <p> inside ListItemText which may itself render a <p> */}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="span"
                        >
                          {c.text}
                        </Typography>
                        {c.createdAt && (
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            component="div"
                            sx={{ display: "block", mt: 0.5 }}
                          >
                            {new Date(c.createdAt).toLocaleString()}
                          </Typography>
                        )}
                      </>
                    }
                    secondaryTypographyProps={{ component: "span" }}
                  />
                </ListItem>
                {i < comments.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>

      {/* Comment Form */}
      <Paper
        elevation={3}
        sx={{ p: 3, borderRadius: 3, backgroundColor: "#fff" }}
      >
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Leave a Comment
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="Email"
            name="email"
            value={email}
            onChange={handleEmailChange}
            fullWidth
            margin="normal"
            required
            type="email"
          />
          <TextField
            label="Comment"
            name="text"
            value={form.text}
            onChange={handleChange}
            fullWidth
            margin="normal"
            multiline
            rows={3}
            required
          />
          <Box mt={2} display="flex" alignItems="center" gap={2}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
            >
              {file ? file.name : "Upload Avatar"}
              <input type="file" hidden accept="image/*" onChange={handleFileChange} />
            </Button>
          </Box>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            sx={{ mt: 3, borderRadius: 2 }}
            fullWidth
          >
            Submit Comment
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
