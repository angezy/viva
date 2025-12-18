"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

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
        throw new Error(data.error || data.message || "Admin signup failed");
      }
      await Swal.fire({ icon: "success", title: "Admin created", timer: 1000, showConfirmButton: false });
      router.push("/signin/admin");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1220", color: "white", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "rgba(15,23,42,0.8)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Admin Signup</h1>
        <p style={{ color: "#cbd5f5", marginBottom: 16 }}>Create an admin account with dashboard access.</p>
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
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={handleChange("password")}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "12px 14px", background: "#22c55e", border: "none", color: "white", borderRadius: 10, cursor: loading ? "default" : "pointer", fontWeight: 700 }}
          >
            {loading ? "Creating..." : "Create admin"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/signin/admin")}
            style={{ background: "transparent", border: "none", color: "#22c55e", cursor: "pointer" }}
          >
            Already have an admin account? Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
