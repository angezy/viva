"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { toast } from "../lib/notifications";

const API_BASE = "";

const labelSx = { color: "var(--color-text-secondary)" };
const inputSx = {
  color: "var(--color-text-primary)",
  backgroundColor: "#ffffff",
  borderRadius: 1.5,
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-border)" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-primary)" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-primary)" },
};
const helperSx = { color: "var(--color-text-secondary)" };
const checkboxSx = {
  color: "#a0a2a5",
  "&.Mui-checked": { color: "var(--color-accent)" },
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const days = Array.from({ length: 31 }, (_, index) => String(index + 1));

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  smsMarketing: false,
  birthdayMonth: "",
  birthdayDay: "",
  zip: "",
  keepSignedIn: false,
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) {
      setError("First name, last name, email, and password are required.");
      return;
    }
    if (form.password.length < 6 || form.password.length > 12) {
      setError("Password must be between 6 and 12 characters.");
      return;
    }
    if (form.smsMarketing && !form.phone.trim()) {
      setError("Enter a phone number to receive marketing text alerts, or leave the alert option unchecked.");
      return;
    }

    setLoading(true);
    try {
      try {
        localStorage.setItem("weluxoKeepSignedIn", String(form.keepSignedIn));
      } catch (_error) {
        // Remembering the preference is optional and must not block signup.
      }

      const username = `${form.firstName.trim()}.${form.lastName.trim()}`.toLowerCase().replace(/[^a-z0-9.]+/g, "").slice(0, 100);
      const response = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, username }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "Signup failed");

      toast.success("Account created", { description: "You can now sign in.", duration: 1200 });
      router.push("/signin");
    } catch (submitError) {
      setError(submitError.message || "Signup failed");
      toast.error("Signup failed", { description: submitError.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", bgcolor: "var(--color-background)", color: "var(--color-text-primary)", py: { xs: 3, sm: 6 } }}>
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: 3, border: "1px solid var(--color-border)", bgcolor: "#ffffff", boxShadow: "0 20px 60px rgba(43,43,43,0.08)" }}>
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Create your account</Typography>
            <Typography sx={{ color: "var(--color-text-secondary)", mb: 3 }}>Join Weluxo for a more personal shopping experience.</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Stack spacing={2} component="form" onSubmit={handleSubmit}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="First Name" value={form.firstName} onChange={handleChange("firstName")} fullWidth required InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }} />
                <TextField label="Last Name" value={form.lastName} onChange={handleChange("lastName")} fullWidth required InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }} />
              </Stack>

              <TextField label="Email Address" type="email" value={form.email} onChange={handleChange("email")} fullWidth required autoComplete="email" InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }} />
              <TextField label="Password (6 to 12 characters)" type="password" value={form.password} onChange={handleChange("password")} fullWidth required inputProps={{ minLength: 6, maxLength: 12 }} autoComplete="new-password" helperText="Use 6–12 characters." FormHelperTextProps={{ sx: helperSx }} InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }} />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <TextField label="Phone Number" type="tel" value={form.phone} onChange={handleChange("phone")} fullWidth autoComplete="tel" InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }} />
                <Typography sx={{ flex: 1, minWidth: 190, color: "var(--color-text-secondary)", fontSize: 12, lineHeight: 1.35, fontWeight: 700 }}>Enter your phone number for easy lookup in stores.</Typography>
              </Stack>

              <FormControlLabel
                control={<Checkbox checked={form.smsMarketing} onChange={(event) => setForm((current) => ({ ...current, smsMarketing: event.target.checked }))} sx={checkboxSx} />}
                label={<Typography sx={{ color: "var(--color-text-primary)", fontSize: 14, fontWeight: 750 }}>Sign me up for Weluxo marketing text alerts.</Typography>}
                sx={{ m: 0, alignItems: "flex-start" }}
              />
              <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 12, lineHeight: 1.55, mt: -1 }}>
                By entering your phone number and selecting this checkbox, you consent to recurring automated marketing text messages from Weluxo. Consent is not a condition of purchase. Message and data rates may apply. See our <MuiLink href="/privacy-policy" underline="always" sx={{ color: "var(--color-primary)" }}>Privacy Policy</MuiLink> and <MuiLink href="/terms-conditions" underline="always" sx={{ color: "var(--color-primary)" }}>Terms of Use</MuiLink>. Reply STOP to cancel at any time.
              </Typography>

              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pt: 0.5 }}>
                <CakeOutlinedIcon sx={{ color: "var(--color-accent)" }} />
                <Typography sx={{ color: "var(--color-text-primary)", fontSize: 14, fontWeight: 750 }}>Enter your birthday to receive a free gift every year.</Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select label="Month" value={form.birthdayMonth} onChange={handleChange("birthdayMonth")} fullWidth InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }}>
                  {months.map((month) => <MenuItem key={month} value={month}>{month}</MenuItem>)}
                </TextField>
                <TextField select label="Day" value={form.birthdayDay} onChange={handleChange("birthdayDay")} fullWidth InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }}>
                  {days.map((day) => <MenuItem key={day} value={day}>{day}</MenuItem>)}
                </TextField>
              </Stack>

              <TextField label="ZIP / Postal Code (optional)" value={form.zip} onChange={handleChange("zip")} fullWidth autoComplete="postal-code" InputLabelProps={{ sx: labelSx }} InputProps={{ sx: inputSx }} />

              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ ml: -1 }}>
                <FormControlLabel
                  control={<Checkbox checked={form.keepSignedIn} onChange={(event) => setForm((current) => ({ ...current, keepSignedIn: event.target.checked }))} sx={checkboxSx} />}
                  label={<Typography sx={{ color: "var(--color-text-primary)", fontSize: 14 }}>Keep me signed in</Typography>}
                  sx={{ m: 0 }}
                />
                <Tooltip title="We only remember this preference. Your password is never stored in the browser.">
                  <InfoOutlinedIcon sx={{ color: "var(--color-text-secondary)", fontSize: 18, cursor: "help" }} />
                </Tooltip>
              </Stack>
              <Typography sx={{ color: "var(--color-text-secondary)", fontSize: 12, lineHeight: 1.55 }}>
                By clicking Join Now, you agree to our <MuiLink href="/terms-conditions" underline="always" sx={{ color: "var(--color-primary)" }}>Terms of Use</MuiLink> and acknowledge our <MuiLink href="/privacy-policy" underline="always" sx={{ color: "var(--color-primary)" }}>Privacy Policy</MuiLink>.
              </Typography>

              <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ borderRadius: 999, py: 1.35, backgroundColor: "var(--color-primary)", color: "#ffffff", fontWeight: 800, textTransform: "none", "&:hover": { backgroundColor: "var(--color-primary-dark)" } }}>
                {loading ? "Joining..." : "Join Now"}
              </Button>
              <Button variant="text" onClick={() => router.push("/signin")} sx={{ color: "var(--color-primary)" }}>Already have an account? Sign in</Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
