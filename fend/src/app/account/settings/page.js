"use client";

import { useEffect, useState } from "react";
import { AccountPageSkeleton } from "../../components/LoadingSkeletons";
import { fetchAccountDetails, updateAccountPassword, updateAccountPreferences } from "../../lib/apiClient";
import styles from "../account.module.css";

export default function SettingsPage() {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetchAccountDetails()
      .then((accountDetails) => {
        if (!active) return;
        setDetails(accountDetails || null);
        setEmailMarketing(Boolean(accountDetails?.preferences?.emailMarketing));
      })
      .catch((loadError) => active && setError(loadError.message || "Unable to load your settings"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function updatePasswordField(event) {
    setPasswords((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    try {
      setSavingPassword(true);
      await updateAccountPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Password changed successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handlePreferenceChange(event) {
    const nextValue = event.target.checked;
    setEmailMarketing(nextValue);
    setError("");
    setSuccess("");
    try {
      setSavingPreference(true);
      const preferences = await updateAccountPreferences({ emailMarketing: nextValue });
      setDetails((current) => ({ ...current, preferences }));
      setSuccess("Email preferences updated.");
    } catch (saveError) {
      setEmailMarketing(!nextValue);
      setError(saveError.message || "Unable to update email preferences");
    } finally {
      setSavingPreference(false);
    }
  }

  if (loading) return <AccountPageSkeleton variant="settings" />;
  if (!details?.profile) return <div className={styles.heroTitle}>Sign in to manage your settings.</div>;

  return (
    <div className={styles.subPage}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ACCOUNT CONTROL</p>
          <div className={styles.heroTitle}>Settings and security</div>
          <div className={styles.heroSub}>Manage your password and communication preferences.</div>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Change password</div>
            <div className={styles.panelSubtitle}>Use a strong password with at least 8 characters.</div>
          </div>
        </div>
        <form className={styles.accountForm} onSubmit={handlePasswordSubmit}>
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span>Current password</span>
              <input className={styles.formInput} name="currentPassword" type="password" value={passwords.currentPassword} onChange={updatePasswordField} autoComplete="current-password" required />
            </label>
            <label className={styles.formField}>
              <span>New password</span>
              <input className={styles.formInput} name="newPassword" type="password" value={passwords.newPassword} onChange={updatePasswordField} autoComplete="new-password" minLength={8} required />
            </label>
            <label className={styles.formField}>
              <span>Confirm new password</span>
              <input className={styles.formInput} name="confirmPassword" type="password" value={passwords.confirmPassword} onChange={updatePasswordField} autoComplete="new-password" minLength={8} required />
            </label>
          </div>
          <div className={styles.formFooter}>
            <span className={error ? styles.formError : styles.formSuccess} role="status">{error || success}</span>
            <button className={styles.primaryBtn} type="submit" disabled={savingPassword}>{savingPassword ? "Updating..." : "Change password"}</button>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Email preferences</div>
            <div className={styles.panelSubtitle}>Choose whether you want to receive product news and offers.</div>
          </div>
        </div>
        <label className={styles.preferenceRow}>
          <span>
            <strong>Marketing emails</strong>
            <small>Receive news, product updates, and occasional offers.</small>
          </span>
          <input type="checkbox" checked={emailMarketing} onChange={handlePreferenceChange} disabled={savingPreference} />
        </label>
      </section>
    </div>
  );
}
