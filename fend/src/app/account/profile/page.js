"use client";

import { useEffect, useState } from "react";
import { AccountPageSkeleton } from "../../components/LoadingSkeletons";
import { fetchAccountDetails, updateAccountProfile } from "../../lib/apiClient";
import styles from "../account.module.css";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetchAccountDetails()
      .then((details) => {
        if (!active) return;
        const current = details?.profile;
        setProfile(current || null);
        setForm({ name: current?.name || current?.username || "", email: current?.email || "", phone: current?.phone || "" });
      })
      .catch((loadError) => active && setError(loadError.message || "Unable to load your profile"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      setSaving(true);
      const updated = await updateAccountProfile(form);
      setProfile(updated);
      setForm({ name: updated?.name || updated?.username || form.name, email: updated?.email || form.email, phone: updated?.phone || "" });
      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update your profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AccountPageSkeleton variant="profile" />;
  if (!profile) return <div className={styles.heroTitle}>Sign in to view your profile.</div>;

  return (
    <div className={styles.subPage}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>YOUR INFORMATION</p>
          <div className={styles.heroTitle}>Profile details</div>
          <div className={styles.heroSub}>Keep your contact information up to date.</div>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Contact information</div>
            <div className={styles.panelSubtitle}>This information is used for your account and order updates.</div>
          </div>
        </div>
        <form className={styles.accountForm} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span>Full name</span>
              <input className={styles.formInput} name="name" value={form.name} onChange={updateField} autoComplete="name" required />
            </label>
            <label className={styles.formField}>
              <span>Email address</span>
              <input className={styles.formInput} name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required />
            </label>
            <label className={styles.formField}>
              <span>Phone number <em>Optional</em></span>
              <input className={styles.formInput} name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" placeholder="e.g. +1 555 000 0000" />
            </label>
          </div>
          <div className={styles.formFooter}>
            <span className={error ? styles.formError : styles.formSuccess} role="status">{error || success}</span>
            <button className={styles.primaryBtn} type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </form>
      </section>

      <section className={styles.infoCard}>
        <div className={styles.sectionHeaderCompact}>
          <div>
            <p className={styles.eyebrow}>ACCOUNT STATUS</p>
            <h2>Member details</h2>
          </div>
        </div>
        <dl className={styles.detailList}>
          <div><dt>Account type</dt><dd>{profile.role || "Customer"}</dd></div>
          <div><dt>Member since</dt><dd>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</dd></div>
        </dl>
      </section>
    </div>
  );
}
