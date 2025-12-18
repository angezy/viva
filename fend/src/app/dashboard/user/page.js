"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Skeleton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack as MuiStack,
  Grid,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

const display = (value) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" && value.trim() === "") return "-";
  return value;
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:5000/api/dashboard/users", { credentials: "include" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const rowsToRender = loading ? Array.from({ length: 5 }) : users;

  return (
    <Box sx={{ p: 4, bgcolor: "#f9fafb", minHeight: "100vh" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <div>
          <Typography variant="h4" fontWeight="bold">
            Users
          </Typography>
          <Typography color="text.secondary" variant="body2">
            All registered users with their roles and activity.
          </Typography>
        </div>
        {!loading && (
          <Chip label={`${users.length} total`} color="primary" variant="outlined" size="small" />
        )}
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? rowsToRender.map((_, idx) => (
                  <TableRow key={`sk-${idx}`}>
                    <TableCell colSpan={7}>
                      <Skeleton variant="rounded" height={32} />
                    </TableCell>
                  </TableRow>
                ))
              : users.map((user) => (
                  <TableRow key={user.id ?? user.email}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={user.avatar || undefined}
                          alt={user.username || user.name || "User"}
                          sx={{ width: 36, height: 36 }}
                        >
                          {(user.username || user.name || user.email || "U").slice(0, 1).toUpperCase()}
                        </Avatar>
                        <div>
                          <Typography fontWeight="bold" variant="body2">
                            {user.username || user.name || "Unnamed"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {user.id ?? "?"}
                          </Typography>
                        </div>
                      </Stack>
                    </TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role || "user"}
                        size="small"
                        color={user.role === "admin" ? "primary" : "default"}
                        variant={user.role === "admin" ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>{formatDate(user.lastLogin)}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.banned ? "Banned" : "Active"}
                        size="small"
                        color={user.banned ? "error" : "success"}
                        variant={user.banned ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelected(user);
                          setEdit({
                            role: user.role || "user",
                            banned: !!user.banned,
                            country: user.country || "",
                            state: user.state || "",
                            city: user.city || "",
                            zip: user.zip || "",
                            address: user.address || "",
                          });
                        }}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography align="center" color="text.secondary" py={2}>
                    No users found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>User details</DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  src={selected.avatar || undefined}
                  alt={selected.username || selected.name || "User"}
                  sx={{ width: 48, height: 48 }}
                >
                  {(selected.username || selected.name || selected.email || "U").slice(0, 1).toUpperCase()}
                </Avatar>
                <div>
                  <Typography variant="h6">{selected.username || selected.name || "User"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {selected.id ?? "-"}
                  </Typography>
                </div>
              </Stack>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body1">{display(selected.email)}</Typography>
                  </MuiStack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Role
                    </Typography>
                    <Select
                      size="small"
                      value={edit?.role || "user"}
                      onChange={(e) => setEdit((prev) => ({ ...prev, role: e.target.value }))}
                      fullWidth
                    >
                      <MenuItem value="user">User</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </MuiStack>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Country / State
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        placeholder="Country"
                        value={edit?.country || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, country: e.target.value }))}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        placeholder="State"
                        value={edit?.state || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, state: e.target.value }))}
                        fullWidth
                      />
                    </Stack>
                  </MuiStack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      City / ZIP
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        placeholder="City"
                        value={edit?.city || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, city: e.target.value }))}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        placeholder="ZIP"
                        value={edit?.zip || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, zip: e.target.value }))}
                        fullWidth
                      />
                    </Stack>
                  </MuiStack>
                </Grid>

                <Grid item xs={12}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="Address"
                      value={edit?.address || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, address: e.target.value }))}
                      fullWidth
                    />
                  </MuiStack>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Created At
                    </Typography>
                    <Typography variant="body1">{formatDate(selected.createdAt)}</Typography>
                  </MuiStack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Last Login
                    </Typography>
                    <Typography variant="body1">{formatDate(selected.lastLogin)}</Typography>
                  </MuiStack>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!edit?.banned}
                        onChange={(e) => setEdit((prev) => ({ ...prev, banned: e.target.checked }))}
                      />
                    }
                    label={edit?.banned ? "Banned" : "Active"}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Signup IP
                    </Typography>
                    <Typography variant="body1">{display(selected.signupIp)}</Typography>
                  </MuiStack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Last IP
                    </Typography>
                    <Typography variant="body1">{display(selected.lastIp)}</Typography>
                  </MuiStack>
                </Grid>

                <Grid item xs={12}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Orders
                    </Typography>
                    <Typography variant="body1">{selected.orderCount ?? 0} orders</Typography>
                  </MuiStack>
                </Grid>
              </Grid>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            disabled={deleting}
            onClick={async () => {
              if (!selected) return;
              const confirmDelete = window.confirm("Delete this user? This cannot be undone.");
              if (!confirmDelete) return;
              setDeleting(true);
              try {
                const res = await fetch(`http://localhost:5000/api/dashboard/users/${selected.id}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || data.message || `Delete failed (${res.status})`);
                }
                await fetchUsers();
                setSelected(null);
              } catch (err) {
                alert(err.message || "Delete failed");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <Button onClick={() => setSelected(null)}>Close</Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              if (!selected || !edit) return;
              setSaving(true);
              try {
                const res = await fetch(`http://localhost:5000/api/dashboard/users/${selected.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(edit),
                  credentials: "include",
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || data.message || `Update failed (${res.status})`);
                }
                await fetchUsers();
                setSelected(null);
              } catch (err) {
                alert(err.message || "Update failed");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
