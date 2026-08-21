"use client";

import { useEffect, useState } from "react";
import { fetchProfile, fetchSession, updateProfileName } from "../../lib/apiClient";
import styles from "../account.module.css";

export default function SettingsPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const session = await fetchSession();
      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const prof = await fetchProfile();
      const current = prof || session.user;
      setProfile(current);
      setUsername(current?.username || current?.name || "");
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!username.trim()) {
      setError("Please enter a name.");
      return;
    }
    try {
      setSaving(true);
      const updated = await updateProfileName(username.trim());
      setProfile(updated);
      setSuccess("Name updated");
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.heroTitle}>Loading settings...</div>;
  if (!profile) return <div className={styles.heroTitle}>Sign in to change your settings.</div>;

  return (
    <div>
      <div className={styles.hero}>
        <div>
          <div className={styles.heroTitle}>Settings</div>
          <div className={styles.heroSub}>Update your account name.</div>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>Profile</div>
          <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>Name</span>
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "var(--color-text-primary)", fontWeight: 600 }}>
            Display name
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 14,
              }}
              placeholder="Your name"
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
          {error && <div style={{ color: "#dc2626" }}>{error}</div>}
          {success && <div style={{ color: "#0b6c3a" }}>{success}</div>}
        </form>
      </section>
    </div>
  );
}
