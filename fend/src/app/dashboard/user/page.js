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
import { toast } from "../../lib/notifications";

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
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: "", email: "", password: "" });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [currentRole, setCurrentRole] = useState("");
  const canManageStaff = currentRole === "owner";

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/users", { credentials: "include" });
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
    queueMicrotask(fetchUsers);
    fetch("/api/session/validate?role=admin", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setCurrentRole(String(data?.user?.role || "").toLowerCase()))
      .catch(() => setCurrentRole(""));
  }, []);

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setCreatingAdmin(true);
    try {
      const res = await fetch("/api/register/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(adminForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Admin creation failed");
      }
      toast.success("Admin created");
      setAdminForm({ username: "", email: "", password: "" });
      setCreateAdminOpen(false);
      await fetchUsers();
    } catch (err) {
      toast.error("Admin creation failed", { description: err.message || "Please try again." });
    } finally {
      setCreatingAdmin(false);
    }
  };

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
        <Stack direction="row" spacing={1.5} alignItems="center">
          {!loading && (
            <Chip label={`${users.length} total`} color="primary" variant="outlined" size="small" />
          )}
          {canManageStaff && <Button variant="contained" onClick={() => setCreateAdminOpen(true)}>Create admin</Button>}
        </Stack>
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
                    <TableCell>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Skeleton variant="circular" width={36} height={36} />
                        <Skeleton variant="text" width={110} />
                      </Stack>
                    </TableCell>
                    {Array.from({ length: 5 }, (_, cell) => <TableCell key={cell}><Skeleton variant="text" width={cell === 1 ? "72%" : "58%"} /></TableCell>)}
                    <TableCell align="right"><Skeleton variant="rounded" width={72} height={30} sx={{ borderRadius: 1.5 }} /></TableCell>
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
                        color={user.role === "owner" ? "warning" : user.role === "admin" ? "primary" : "default"}
                        variant={user.role === "owner" || user.role === "admin" ? "filled" : "outlined"}
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
                            role: user.role || "customer",
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

      <Dialog
        open={createAdminOpen}
        onClose={() => !creatingAdmin && setCreateAdminOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={handleCreateAdmin}>
          <DialogTitle>Create admin</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Add an administrator with access to the dashboard.
              </Typography>
              <TextField
                label="Username"
                value={adminForm.username}
                onChange={(event) => setAdminForm((prev) => ({ ...prev, username: event.target.value }))}
                autoComplete="username"
                required
                fullWidth
                disabled={creatingAdmin}
              />
              <TextField
                label="Email"
                type="email"
                value={adminForm.email}
                onChange={(event) => setAdminForm((prev) => ({ ...prev, email: event.target.value }))}
                autoComplete="email"
                required
                fullWidth
                disabled={creatingAdmin}
              />
              <TextField
                label="Password"
                type="password"
                value={adminForm.password}
                onChange={(event) => setAdminForm((prev) => ({ ...prev, password: event.target.value }))}
                autoComplete="new-password"
                required
                fullWidth
                disabled={creatingAdmin}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateAdminOpen(false)} disabled={creatingAdmin}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={creatingAdmin}>
              {creatingAdmin ? "Creating..." : "Create admin"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

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
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body1">{display(selected.email)}</Typography>
                  </MuiStack>
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Role
                    </Typography>
                    <Select
                      size="small"
                      value={edit?.role || "customer"}
                      onChange={(e) => setEdit((prev) => ({ ...prev, role: e.target.value }))}
                      disabled={!canManageStaff}
                      fullWidth
                    >
                      <MenuItem value="customer">Customer</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="owner">Owner</MenuItem>
                    </Select>
                  </MuiStack>
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
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
                        disabled={!canManageStaff}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        placeholder="State"
                        value={edit?.state || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, state: e.target.value }))}
                        disabled={!canManageStaff}
                        fullWidth
                      />
                    </Stack>
                  </MuiStack>
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
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
                        disabled={!canManageStaff}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        placeholder="ZIP"
                        value={edit?.zip || ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, zip: e.target.value }))}
                        disabled={!canManageStaff}
                        fullWidth
                      />
                    </Stack>
                  </MuiStack>
                </Grid>

                <Grid size={12}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="Address"
                      value={edit?.address || ""}
                      onChange={(e) => setEdit((prev) => ({ ...prev, address: e.target.value }))}
                      disabled={!canManageStaff}
                      fullWidth
                    />
                  </MuiStack>
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Created At
                    </Typography>
                    <Typography variant="body1">{formatDate(selected.createdAt)}</Typography>
                  </MuiStack>
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Last Login
                    </Typography>
                    <Typography variant="body1">{formatDate(selected.lastLogin)}</Typography>
                  </MuiStack>
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!edit?.banned}
                        onChange={(e) => setEdit((prev) => ({ ...prev, banned: e.target.checked }))}
                        disabled={!canManageStaff}
                      />
                    }
                    label={edit?.banned ? "Banned" : "Active"}
                  />
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Signup IP
                    </Typography>
                    <Typography variant="body1">{display(selected.signupIp)}</Typography>
                  </MuiStack>
                </Grid>
                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}>
                  <MuiStack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Last IP
                    </Typography>
                    <Typography variant="body1">{display(selected.lastIp)}</Typography>
                  </MuiStack>
                </Grid>

                <Grid size={12}>
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
          {canManageStaff && <Button
            color="error"
            disabled={deleting}
            onClick={async () => {
              if (!selected) return;
              const confirmDelete = window.confirm("Delete this user? This cannot be undone.");
              if (!confirmDelete) return;
              setDeleting(true);
              try {
                const res = await fetch(`/api/dashboard/users/${selected.id}`, {
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
          </Button>}
          <Button onClick={() => setSelected(null)}>Close</Button>
          {canManageStaff && <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              if (!selected || !edit) return;
              setSaving(true);
              try {
                const res = await fetch(`/api/dashboard/users/${selected.id}`, {
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
          </Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
