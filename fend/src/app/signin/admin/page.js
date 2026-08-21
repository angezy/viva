"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginRequest } from "../../lib/apiClient";
import { toast } from "../../lib/notifications";

export default function AdminSigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginRequest(email, password, "admin");
      toast.success("Welcome, admin", { duration: 700 });
      setTimeout(() => router.push("/dashboard"), 700);
    } catch (err) {
      setError(err.message || "Login failed");
      toast.error("Login failed", { description: err.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: "var(--color-background)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ padding: 28, background: "#ffffff", borderRadius: 16, width: "100%", maxWidth: 420, border: "1px solid var(--color-border)", boxShadow: "0 20px 60px rgba(43,43,43,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Admin Sign in</h1>
        <p style={{ marginTop: 8, marginBottom: 20, color: '#cbd5f5' }}>Dashboard access is restricted to admins.</p>

        <form onSubmit={handleSubmit} aria-describedby={error ? 'signin-error' : undefined}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13 }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', width: '100%', background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)' }}
                disabled={loading}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13 }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', width: '100%', background: 'var(--color-surface-muted)', color: 'var(--color-text-primary)' }}
                disabled={loading}
              />
            </label>

            {error && (
              <div id="signin-error" role="alert" style={{ color: '#fca5a5', background: '#7f1d1d', padding: 10, borderRadius: 8, border: '1px solid #f87171' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: loading ? 'default' : 'pointer',
                  minWidth: 120,
                }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setEmail(''); setPassword(''); setError('') }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
