"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "../../lib/notifications";

const API_BASE = "";

export default function AdminSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username || !form.email || !form.password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/register/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/signin/admin");
          return;
        }
        throw new Error(data.error || data.message || "Admin signup failed");
      }
      toast.success("Admin created", { duration: 1000 });
      router.push("/signin/admin");
    } catch (err) {
      setError(err.message || "Signup failed");
      toast.error("Signup failed", { description: err.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background)", color: "var(--color-text-primary)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#ffffff", borderRadius: 16, padding: 24, border: "1px solid var(--color-border)", boxShadow: "0 20px 60px rgba(43,43,43,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Admin Signup</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>An existing administrator must be signed in to provision another admin account.</p>
        {error && (
          <div style={{ color: "#fca5a5", background: "#7f1d1d", padding: 10, borderRadius: 8, border: "1px solid #f87171", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Username"
            value={form.username}
            onChange={handleChange("username")}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-muted)", color: "var(--color-text-primary)" }}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-muted)", color: "var(--color-text-primary)" }}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={handleChange("password")}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-muted)", color: "var(--color-text-primary)" }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "12px 14px", background: "var(--color-primary)", border: "none", color: "#ffffff", borderRadius: 10, cursor: loading ? "default" : "pointer", fontWeight: 700 }}
          >
            {loading ? "Creating..." : "Create admin"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/signin/admin")}
            style={{ background: "transparent", border: "none", color: "var(--color-primary)", cursor: "pointer" }}
          >
            Already have an admin account? Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
