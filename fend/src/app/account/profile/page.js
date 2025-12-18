"use client";

import { useEffect, useState } from "react";
import { fetchSession, fetchProfile } from "../../lib/apiClient";
import styles from "../account.module.css";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
      setProfile(prof || session.user);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className={styles.heroTitle}>Loading profile...</div>;
  }

  if (!profile) {
    return <div className={styles.heroTitle}>Please sign in to view your profile.</div>;
  }

  return (
    <div>
      <div className={styles.hero}>
        <div>
          <div className={styles.heroTitle}>Profile</div>
          <div className={styles.heroSub}>Your account basics.</div>
        </div>
      </div>

      <section className={styles.panel} id="profile">
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>User info</div>
        </div>
        <ul className={styles.legendList}>
          <li className={styles.legendItem}>
            <div className={styles.legendLeft}>
              <span className={styles.dot} style={{ background: "#60a5fa" }} />
              <span>Name</span>
            </div>
            <strong>{profile.username || profile.name || "Member"}</strong>
          </li>
          <li className={styles.legendItem}>
            <div className={styles.legendLeft}>
              <span className={styles.dot} style={{ background: "#22c55e" }} />
              <span>Email</span>
            </div>
            <strong>{profile.email}</strong>
          </li>
          <li className={styles.legendItem}>
            <div className={styles.legendLeft}>
              <span className={styles.dot} style={{ background: "#f97316" }} />
              <span>Role</span>
            </div>
            <strong>{profile.role || "user"}</strong>
          </li>
          <li className={styles.legendItem}>
            <div className={styles.legendLeft}>
              <span className={styles.dot} style={{ background: "#a855f7" }} />
              <span>Member since</span>
            </div>
            <strong>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "n/a"}</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}
