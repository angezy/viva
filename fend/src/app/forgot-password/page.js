"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from "../lib/apiClient";
import { toast } from "../lib/notifications";

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 1.5,
  },
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("signinEmail");
      if (savedEmail) setEmail(savedEmail);
    } catch (_error) {
      // Remembered email is optional.
    }
  }, []);

  const clearError = () => setError("");

  async function handleRequest(event) {
    event?.preventDefault();
    clearError();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setCode("");
      setStep("verify");
      toast.success("Check your email", { description: "Your verification code is on its way." });
    } catch (requestError) {
      setError(requestError.message || "Unable to send reset code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    clearError();
    setLoading(true);
    try {
      const result = await verifyPasswordResetCode(email, code.trim());
      setResetToken(result.resetToken || "");
      setStep("reset");
      toast.success("Code verified", { description: "Choose a new password." });
    } catch (verifyError) {
      setError(verifyError.message || "That code is invalid or expired");
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    clearError();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6 || password.length > 64) {
      setError("Password must be between 6 and 64 characters.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, resetToken, password);
      setStep("success");
      toast.success("Password updated", { description: "You can now sign in with your new password." });
    } catch (resetError) {
      setError(resetError.message || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setStep("request");
    setCode("");
    setResetToken("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    clearError();
  }

  return (
    <Box sx={{ p: { xs: 3, sm: 4 } }}>
      <Typography variant="overline" sx={{ color: "#0f766e", fontWeight: 800, letterSpacing: "0.12em" }}>
        CUSTOMER ACCOUNT
      </Typography>
      <Typography component="h1" variant="h4" sx={{ mt: 0.5, fontWeight: 800 }}>
        {step === "success" ? "Password updated" : "Reset your password"}
      </Typography>
      <Typography sx={{ mt: 1, mb: 3, color: "#52606d", lineHeight: 1.6 }}>
        {step === "request" && "Enter your customer account email and we’ll send you a one-time verification code."}
        {step === "verify" && <>We sent a six-digit code to <strong>{email}</strong>.</>}
        {step === "reset" && "Your code is verified. Choose a new password for your account."}
        {step === "success" && "Your new password is ready. Sign in to continue shopping."}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {step === "request" && (
        <Stack spacing={2} component="form" onSubmit={handleRequest}>
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); clearError(); }}
            required
            fullWidth
            autoComplete="email"
            sx={inputSx}
          />
          <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ borderRadius: 999, py: 1.25, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>
            {loading ? "Sending code..." : "Send verification code"}
          </Button>
        </Stack>
      )}

      {step === "verify" && (
        <Stack spacing={2} component="form" onSubmit={handleVerify}>
          <TextField
            label="Six-digit verification code"
            value={code}
            onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); clearError(); }}
            required
            fullWidth
            autoComplete="one-time-code"
            inputProps={{ inputMode: "numeric", maxLength: 6 }}
            sx={inputSx}
          />
          <Button type="submit" variant="contained" size="large" disabled={loading || code.length !== 6} sx={{ borderRadius: 999, py: 1.25, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>
            {loading ? "Checking code..." : "Verify code"}
          </Button>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button type="button" onClick={startOver} disabled={loading} sx={{ color: "#52606d", textTransform: "none" }}>Use a different email</Button>
            <Button type="button" onClick={handleRequest} disabled={loading} sx={{ color: "#0f766e", textTransform: "none", fontWeight: 700 }}>Resend code</Button>
          </Stack>
        </Stack>
      )}

      {step === "reset" && (
        <Stack spacing={2} component="form" onSubmit={handleReset}>
          <TextField
            label="New password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => { setPassword(event.target.value); clearError(); }}
            required
            fullWidth
            inputProps={{ minLength: 6, maxLength: 64 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    onMouseDown={(event) => event.preventDefault()}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            autoComplete="new-password"
            helperText="Use 6–64 characters."
            sx={inputSx}
          />
          <TextField
            label="Confirm new password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => { setConfirmPassword(event.target.value); clearError(); }}
            required
            fullWidth
            inputProps={{ minLength: 6, maxLength: 64 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    onMouseDown={(event) => event.preventDefault()}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            autoComplete="new-password"
            sx={inputSx}
          />
          <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ borderRadius: 999, py: 1.25, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>
            {loading ? "Updating password..." : "Set new password"}
          </Button>
        </Stack>
      )}

      {step === "success" && (
        <Button component={Link} href="/signin" variant="contained" size="large" fullWidth sx={{ borderRadius: 999, py: 1.25, bgcolor: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>
          Return to sign in
        </Button>
      )}

      {step !== "success" && (
        <Button component={Link} href="/signin" sx={{ mt: 2, color: "#52606d", textTransform: "none" }}>
          Back to sign in
        </Button>
      )}
    </Box>
  );
}
