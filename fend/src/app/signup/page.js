"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Stack,
  Alert,
  MenuItem,
} from "@mui/material";
import Swal from "sweetalert2";
import { Country, State } from "country-state-city";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const labelSx = { color: "rgba(255,255,255,0.85)" };
const inputSx = {
  color: "white",
  backgroundColor: "rgba(255,255,255,0.04)",
  borderRadius: 1.5,
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.35)" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#4dabf7" },
};
const helperSx = { color: "rgba(255,255,255,0.8)" };

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    country: "",
    state: "",
    city: "",
    zip: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const countryOptions = useMemo(
    () =>
      Country.getAllCountries().map((c) => ({
        code: c.isoCode,
        label: c.name,
      })),
    []
  );
  const stateOptions = useMemo(
    () =>
      form.country
        ? State.getStatesOfCountry(form.country).map((s) => ({
            code: s.isoCode,
            label: s.name,
          }))
        : [],
    [form.country]
  );

  const handleChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      if (key === "country") {
        return { ...prev, country: value, state: "" };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username || !form.email || !form.password || !form.country || !form.state || !form.city || !form.zip || !form.address) {
      setError("All required fields must be filled");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Signup failed");
      }
      await Swal.fire({
        icon: "success",
        title: "Account created",
        text: "You can now sign in.",
        timer: 1200,
        showConfirmButton: false,
      });
      router.push("/signin");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", bgcolor: "#0b1220", color: "white", py: 6 }}>
      <Container maxWidth="sm">
        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(180deg, rgba(26,35,58,0.95), rgba(12,18,36,0.98))",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
              Create your account
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3 }}>
              Tell us a little more so we can tailor your experience.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2} component="form" onSubmit={handleSubmit}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="First Name"
                  value={form.firstName}
                  onChange={handleChange("firstName")}
                  fullWidth
                  InputLabelProps={{ sx: labelSx }}
                  InputProps={{ sx: inputSx }}
                />
                <TextField
                  label="Last Name"
                  value={form.lastName}
                  onChange={handleChange("lastName")}
                  fullWidth
                  InputLabelProps={{ sx: labelSx }}
                  InputProps={{ sx: inputSx }}
                />
              </Stack>
              <TextField
                label="Username"
                value={form.username}
                onChange={handleChange("username")}
                fullWidth
                required
                InputLabelProps={{ sx: labelSx }}
                InputProps={{ sx: inputSx }}
              />
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                fullWidth
                required
                InputLabelProps={{ sx: labelSx }}
                InputProps={{ sx: inputSx }}
              />
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                fullWidth
                required
                InputLabelProps={{ sx: labelSx }}
                InputProps={{ sx: inputSx }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Country"
                  value={form.country}
                  onChange={handleChange("country")}
                  fullWidth
                  required
                  InputLabelProps={{ sx: labelSx }}
                  InputProps={{ sx: inputSx }}
                >
                  {countryOptions.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="State / Region"
                  value={form.state}
                  onChange={handleChange("state")}
                  fullWidth
                  required
                  disabled={!form.country}
                  helperText={!form.country ? "Select country first" : ""}
                  InputLabelProps={{ sx: labelSx }}
                  InputProps={{ sx: inputSx }}
                  FormHelperTextProps={{ sx: helperSx }}
                >
                  {stateOptions.map((state) => (
                    <MenuItem key={state.code} value={state.code}>
                      {state.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="City"
                  value={form.city}
                  onChange={handleChange("city")}
                  fullWidth
                  required
                  InputLabelProps={{ sx: labelSx }}
                  InputProps={{ sx: inputSx }}
                />
                <TextField
                  label="ZIP / Postal Code"
                  value={form.zip}
                  onChange={handleChange("zip")}
                  fullWidth
                  required
                  InputLabelProps={{ sx: labelSx }}
                  InputProps={{ sx: inputSx }}
                />
              </Stack>
              <TextField
                label="Address"
                value={form.address}
                onChange={handleChange("address")}
                fullWidth
                required
                placeholder="Street, city, postal code"
                InputLabelProps={{ sx: labelSx }}
                InputProps={{ sx: inputSx }}
              />
              <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ borderRadius: 2 }}>
                {loading ? "Signing up..." : "Create account"}
              </Button>
              <Button variant="text" onClick={() => router.push("/signin")} sx={{ color: "rgba(255,255,255,0.85)" }}>
                Already have an account? Sign in
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
