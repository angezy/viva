"use client";

import React, { useEffect, useState } from "react";

const EMPTY_PRODUCT = { title: "", price: "", image: "" };
const EMPTY_FEATURE = { title: "", copy: "" };

export default function PageEditor() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard/home")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setError("Failed to load content"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (path, value) => {
    setContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        cursor[key] = Array.isArray(cursor[key])
          ? [...cursor[key]]
          : typeof cursor[key] === "object"
          ? { ...cursor[key] }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateArrayItem = (key, index, value) => {
    setContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      arr[index] = value;
      return { ...(prev || {}), [key]: arr };
    });
  };

  async function handleSave() {
    if (!content) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("save");
      setMessage("Saved! Refresh preview if needed.");
    } catch (err) {
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading dashboard editor...</div>;
  }

  if (!content) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No content loaded."}</div>;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, borderBottom: "1px solid #e6e6e6", minHeight: 320 }}>
        <iframe title="Site preview" src="/" style={{ width: "100%", height: "100%", border: 0 }} />
      </div>

      <div style={{ padding: 16, background: "#fafafa", maxHeight: 520, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Homepage Content</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {message && <span style={{ color: "#0a8" }}>{message}</span>}
            {error && <span style={{ color: "#c00" }}>{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #0a66ff",
                background: saving ? "#dbeafe" : "#0a66ff",
                color: "white",
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 12 }}>
          {[0, 1].map((idx) => (
            <SectionCard key={`hero-${idx}`} title={`Hero Card ${idx + 1}`}>
              <Input
                label="Title"
                value={content.heroCards?.[idx]?.title || ""}
                onChange={(v) =>
                  updateArrayItem("heroCards", idx, {
                    ...(content.heroCards?.[idx] || {}),
                    title: v,
                  })
                }
              />
              <Input
                label="Subtitle"
                value={content.heroCards?.[idx]?.subtitle || ""}
                onChange={(v) =>
                  updateArrayItem("heroCards", idx, {
                    ...(content.heroCards?.[idx] || {}),
                    subtitle: v,
                  })
                }
              />
              <Input
                label="Image URL"
                value={content.heroCards?.[idx]?.image || ""}
                onChange={(v) =>
                  updateArrayItem("heroCards", idx, {
                    ...(content.heroCards?.[idx] || {}),
                    image: v,
                  })
                }
              />
              {idx === 1 && (
                <>
                  <Textarea
                    label="Highlights (one per line)"
                    value={(content.heroCards?.[idx]?.highlights || []).join("\n")}
                    onChange={(v) =>
                      updateArrayItem("heroCards", idx, {
                        ...(content.heroCards?.[idx] || {}),
                        highlights: v.split("\n").filter(Boolean),
                      })
                    }
                  />
                  <Input
                    label="CTA text"
                    value={content.heroCards?.[idx]?.cta || ""}
                    onChange={(v) =>
                      updateArrayItem("heroCards", idx, {
                        ...(content.heroCards?.[idx] || {}),
                        cta: v,
                      })
                    }
                  />
                </>
              )}
            </SectionCard>
          ))}

          <SectionCard title="Training Block">
            <Input label="Title" value={content.trainingBlock?.title || ""} onChange={(v) => updateField(["trainingBlock", "title"], v)} />
            <Textarea label="Copy" value={content.trainingBlock?.copy || ""} onChange={(v) => updateField(["trainingBlock", "copy"], v)} />
            <Input label="CTA text" value={content.trainingBlock?.cta || ""} onChange={(v) => updateField(["trainingBlock", "cta"], v)} />
            <Input label="Image URL" value={content.trainingBlock?.image || ""} onChange={(v) => updateField(["trainingBlock", "image"], v)} />
          </SectionCard>

          <SectionCard title="Banner strip">
            <Input label="Text" value={content.bannerText || ""} onChange={(v) => updateField(["bannerText"], v)} />
          </SectionCard>

          <SectionCard title="Welcome block">
            <Input label="Headline" value={content.welcome?.headline || ""} onChange={(v) => updateField(["welcome", "headline"], v)} />
            <Input label="Title" value={content.welcome?.title || ""} onChange={(v) => updateField(["welcome", "title"], v)} />
            <Textarea label="Copy" value={content.welcome?.copy || ""} onChange={(v) => updateField(["welcome", "copy"], v)} />
            <Input label="CTA text" value={content.welcome?.cta || ""} onChange={(v) => updateField(["welcome", "cta"], v)} />
            <Input label="Image URL" value={content.welcome?.image || ""} onChange={(v) => updateField(["welcome", "image"], v)} />
          </SectionCard>

          <SectionCard title="Reviews block">
            <Input label="Headline" value={content.reviews?.headline || ""} onChange={(v) => updateField(["reviews", "headline"], v)} />
            <Input label="Rating text" value={content.reviews?.ratingText || ""} onChange={(v) => updateField(["reviews", "ratingText"], v)} />
          </SectionCard>

          <SectionCard title="Menus">
            <Textarea
              label="Main menu items (one per line)"
              value={(content.menus?.main || []).join("\n")}
              onChange={(v) => updateField(["menus", "main"], v.split("\n").filter(Boolean))}
            />
            <Input label="Footer title" value={content.menus?.footerTitle || ""} onChange={(v) => updateField(["menus", "footerTitle"], v)} />
          </SectionCard>
        </div>

        <SectionCard title="Products (4 cards)" wide>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content.products || []).map((p, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Product {idx + 1}</div>
                <Input
                  label="Title"
                  value={p?.title || ""}
                  onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), title: v })}
                />
                <Input
                  label="Price"
                  value={p?.price || ""}
                  onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), price: v })}
                />
                <Input
                  label="Image URL"
                  value={p?.image || ""}
                  onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), image: v })}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Action shots (image URLs)" wide>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content.actionShots || []).map((url, idx) => (
              <Input
                key={idx}
                label={`Action ${idx + 1}`}
                value={url || ""}
                onChange={(v) => updateArrayItem("actionShots", idx, v)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Features" wide>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content.features || []).map((feat, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input
                  label="Title"
                  value={feat?.title || ""}
                  onChange={(v) => updateArrayItem("features", idx, { ...(feat || EMPTY_FEATURE), title: v })}
                />
                <Textarea
                  label="Copy"
                  value={feat?.copy || ""}
                  onChange={(v) => updateArrayItem("features", idx, { ...(feat || EMPTY_FEATURE), copy: v })}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, children, wide = false }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 12,
        background: "white",
        marginTop: 10,
        gridColumn: wide ? "1 / -1" : "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d4d4d8",
        }}
      />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <textarea
        value={value || ""}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d4d4d8",
          resize: "vertical",
          minHeight: 80,
        }}
      />
    </label>
  );
}
