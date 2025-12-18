"use client";

import React, { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/footer";
import Section from "@/app/components/section";
import BlogSection from "@/app/components/blog";
import AboutSection from "@/app/components/aboutSection";
import { Box } from "@mui/material";

const EMPTY_PRODUCT = { title: "", price: "", image: "", alt: "" };
const EMPTY_FEATURE = { title: "", copy: "" };
const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const EMPTY_POST = {
  id: "",
  title: "",
  excerpt: "",
  author: "",
  date: "",
  image: "",
  alt: "",
  tags: [],
  slug: "",
};
const EMPTY_APPROACH = { title: "", copy: "" };
const EMPTY_TEAM = { name: "", role: "", bio: "", img: "", alt: "" };
const EMPTY_ABOUT = {
  hero: {},
  mission: "",
  values: "",
  team: [],
  story: [],
  approach: [],
  contactCta: {},
};

export default function PageEditor() {
  const [content, setContent] = useState(null);
  const [blogContent, setBlogContent] = useState(null);
  const [aboutContent, setAboutContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingBlog, setLoadingBlog] = useState(true);
  const [loadingAbout, setLoadingAbout] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [previewPath, setPreviewPath] = useState("/");

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard/home")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setError("Failed to load content"))
      .finally(() => mounted && setLoading(false));

    fetch("/api/dashboard/blog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setBlogContent(data))
      .catch(() => mounted && setError("Failed to load blog content"))
      .finally(() => mounted && setLoadingBlog(false));
    fetch("/api/dashboard/about")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setAboutContent(data))
      .catch(() => mounted && setError("Failed to load about content"))
      .finally(() => mounted && setLoadingAbout(false));
    return () => {
      mounted = false;
    };
  }, []);

  const inlinePreviewPaths = ["/", "/blog", "/aboutus"];
  const showInlinePreview = inlinePreviewPaths.includes(previewPath);

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

  const updateBlogPost = (index, value) => {
    setBlogContent((prev) => {
      const arr = Array.isArray(prev?.posts) ? [...prev.posts] : [];
      arr[index] = { ...(arr[index] || EMPTY_POST), ...value };
      return { ...(prev || {}), posts: arr };
    });
  };

  const updateAboutArray = (key, index, value) => {
    setAboutContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      arr[index] = value;
      return { ...(prev || {}), [key]: arr };
    });
  };

  const addAboutItem = (key, value) => {
    setAboutContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      return { ...(prev || {}), [key]: [...arr, value] };
    });
  };

  const removeAboutItem = (key, index) => {
    setAboutContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      arr.splice(index, 1);
      return { ...(prev || {}), [key]: arr };
    });
  };

  async function handleSave() {
    if (!content || !blogContent || !aboutContent) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const blogRes = await fetch("/api/dashboard/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: blogContent }),
      });
      const aboutRes = await fetch("/api/dashboard/about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: aboutContent }),
      });

      if (!res.ok || !blogRes.ok || !aboutRes.ok) throw new Error("save");
      setMessage("Saved! Refresh preview if needed.");
    } catch (err) {
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const openModal = (key) => {
    setActiveSection(key);
    setModalOpen(true);
    setMessage("");
    setError("");
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveSection(null);
  };

  const renderModalBody = () => {
    switch (activeSection) {
      case "hero1":
      case "hero2": {
        const idx = activeSection === "hero1" ? 0 : 1;
        const card = content?.heroCards?.[idx] || {};
        return (
          <>
            <Input label="Title" value={card.title || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, title: v })} />
            <Input label="Subtitle" value={card.subtitle || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, subtitle: v })} />
            <Input label="Alt text" value={card.alt || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, alt: v })} />
            <Input label="Image URL" value={card.image || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, image: v })} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateArrayItem("heroCards", idx, { ...card, image: dataUrl, alt: card.alt || file.name });
              }}
            />
            {idx === 1 && (
              <>
                <Textarea
                  label="Highlights (one per line)"
                  value={(card.highlights || []).join("\n")}
                  onChange={(v) => updateArrayItem("heroCards", idx, { ...card, highlights: v.split("\n").filter(Boolean) })}
                />
                <Input label="CTA text" value={card.cta || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, cta: v })} />
              </>
            )}
          </>
        );
      }
      case "training": {
        const block = content?.trainingBlock || {};
        return (
          <>
            <Input label="Title" value={block.title || ""} onChange={(v) => updateField(["trainingBlock", "title"], v)} />
            <Textarea label="Copy" value={block.copy || ""} onChange={(v) => updateField(["trainingBlock", "copy"], v)} />
            <Input label="CTA text" value={block.cta || ""} onChange={(v) => updateField(["trainingBlock", "cta"], v)} />
            <Input label="Alt text" value={block.alt || ""} onChange={(v) => updateField(["trainingBlock", "alt"], v)} />
            <Input label="Image URL" value={block.image || ""} onChange={(v) => updateField(["trainingBlock", "image"], v)} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateField(["trainingBlock", "image"], dataUrl);
                updateField(["trainingBlock", "alt"], block.alt || file.name);
              }}
            />
          </>
        );
      }
      case "banner":
        return <Input label="Banner text" value={content?.bannerText || ""} onChange={(v) => updateField(["bannerText"], v)} />;
      case "welcome": {
        const welcome = content?.welcome || {};
        return (
          <>
            <Input label="Headline" value={welcome.headline || ""} onChange={(v) => updateField(["welcome", "headline"], v)} />
            <Input label="Title" value={welcome.title || ""} onChange={(v) => updateField(["welcome", "title"], v)} />
            <Textarea label="Copy" value={welcome.copy || ""} onChange={(v) => updateField(["welcome", "copy"], v)} />
            <Input label="CTA text" value={welcome.cta || ""} onChange={(v) => updateField(["welcome", "cta"], v)} />
            <Input label="Alt text" value={welcome.alt || ""} onChange={(v) => updateField(["welcome", "alt"], v)} />
            <Input label="Image URL" value={welcome.image || ""} onChange={(v) => updateField(["welcome", "image"], v)} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateField(["welcome", "image"], dataUrl);
                updateField(["welcome", "alt"], welcome.alt || file.name);
              }}
            />
          </>
        );
      }
      case "reviews": {
        const reviews = content?.reviews || {};
        return (
          <>
            <Input label="Headline" value={reviews.headline || ""} onChange={(v) => updateField(["reviews", "headline"], v)} />
            <Input label="Rating text" value={reviews.ratingText || ""} onChange={(v) => updateField(["reviews", "ratingText"], v)} />
          </>
        );
      }
      case "menus": {
        const menus = content?.menus || {};
        return (
          <>
            <Textarea
              label="Main menu items (one per line)"
              value={(menus.main || []).join("\n")}
              onChange={(v) => updateField(["menus", "main"], v.split("\n").filter(Boolean))}
            />
            <Input label="Footer title" value={menus.footerTitle || ""} onChange={(v) => updateField(["menus", "footerTitle"], v)} />
          </>
        );
      }
      case "products": {
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content?.products || []).map((p, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Product {idx + 1}</div>
                <Input label="Title" value={p?.title || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), title: v })} />
                <Input label="Price" value={p?.price || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), price: v })} />
                <Input label="Alt text" value={p?.alt || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), alt: v })} />
                <Input label="Image URL" value={p?.image || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), image: v })} />
                <FileInput
                  label="Upload image"
                  onSelect={async (file) => {
                    const dataUrl = await readFileAsDataUrl(file);
                    updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), image: dataUrl, alt: p?.alt || file.name });
                  }}
                />
              </div>
            ))}
          </div>
        );
      }
      case "actionShots":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content?.actionShots || []).map((url, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input
                  label={`Action ${idx + 1} video URL (mp4/webm)`}
                  value={typeof url === "string" ? url : url?.video || url?.src || ""}
                  onChange={(v) =>
                    updateArrayItem(
                      "actionShots",
                      idx,
                      typeof url === "string" ? { video: v } : { ...(url || {}), video: v, src: url?.src }
                    )
                  }
                />
                <Input
                  label="Poster image URL (optional)"
                  value={typeof url === "string" ? "" : url?.poster || url?.src || ""}
                  onChange={(v) =>
                    updateArrayItem(
                      "actionShots",
                      idx,
                      typeof url === "string" ? { poster: v } : { ...(url || {}), poster: v }
                    )
                  }
                />
                <Input
                  label="Alt text"
                  value={typeof url === "string" ? "" : url?.alt || ""}
                  onChange={(v) =>
                    updateArrayItem("actionShots", idx, typeof url === "string" ? { video: url, alt: v } : { ...(url || {}), alt: v })
                  }
                />
                <FileInput
                  label="Upload poster"
                  onSelect={async (file) => {
                    const dataUrl = await readFileAsDataUrl(file);
                    const alt = typeof url === "string" ? "" : url?.alt;
                    updateArrayItem("actionShots", idx, { ...(typeof url === "string" ? { video: url } : url), poster: dataUrl, alt: alt || file.name });
                  }}
                />
              </div>
            ))}
          </div>
        );
      case "features":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content?.features || []).map((feat, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input label="Title" value={feat?.title || ""} onChange={(v) => updateArrayItem("features", idx, { ...(feat || EMPTY_FEATURE), title: v })} />
                <Textarea label="Copy" value={feat?.copy || ""} onChange={(v) => updateArrayItem("features", idx, { ...(feat || EMPTY_FEATURE), copy: v })} />
              </div>
            ))}
          </div>
        );
      case "aboutHero": {
        const hero = aboutContent?.hero || {};
        return (
          <>
            <Input label="Title" value={hero.title || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), title: v } }))} />
            <Textarea label="Subtitle" value={hero.subtitle || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), subtitle: v } }))} />
            <Input label="CTA text" value={hero.ctaText || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), ctaText: v } }))} />
            <Input label="CTA URL" value={hero.ctaUrl || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), ctaUrl: v } }))} />
            <Input label="Alt text" value={hero.alt || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), alt: v } }))} />
            <Input label="Image URL" value={hero.image || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), image: v } }))} />
          </>
        );
      }
      case "aboutMission":
        return <Textarea label="Mission" value={aboutContent?.mission || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), mission: v }))} />;
      case "aboutValues":
        return <Textarea label="Values" value={aboutContent?.values || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), values: v }))} />;
      case "aboutStory":
        return (
          <Textarea
            label="Story (paragraphs separated by blank lines)"
            value={(aboutContent?.story || []).join("\n\n")}
            onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), story: v.split(/\n\s*\n/).filter(Boolean) }))}
          />
        );
      case "aboutContactCta": {
        const cta = aboutContent?.contactCta || {};
        return (
          <>
            <Input label="Headline" value={cta.title || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), contactCta: { ...(cta || {}), title: v } }))} />
            <Textarea label="Body" value={cta.copy || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), contactCta: { ...(cta || {}), copy: v } }))} />
            <Input label="Button text" value={cta.buttonText || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), contactCta: { ...(cta || {}), buttonText: v } }))} />
            <Input label="Button URL" value={cta.buttonUrl || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), contactCta: { ...(cta || {}), buttonUrl: v } }))} />
          </>
        );
      }
      case "aboutApproach": {
        const approach = Array.isArray(aboutContent?.approach) && aboutContent.approach.length ? aboutContent.approach : [EMPTY_APPROACH];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {approach.map((item, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input label="Title" value={item?.title || ""} onChange={(v) => updateAboutArray("approach", idx, { ...(item || EMPTY_APPROACH), title: v })} />
                <Textarea label="Copy" value={item?.copy || ""} onChange={(v) => updateAboutArray("approach", idx, { ...(item || EMPTY_APPROACH), copy: v })} />
              </div>
            ))}
            <button
              onClick={() => addAboutItem("approach", { ...EMPTY_APPROACH, title: "New step" })}
              style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}
            >
              + Add step
            </button>
          </div>
        );
      }
      case "aboutTeam": {
        const team = Array.isArray(aboutContent?.team) && aboutContent.team.length ? aboutContent.team : [EMPTY_TEAM];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
            {team.map((member, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white", position: "relative" }}>
                <Input label="Name" value={member?.name || ""} onChange={(v) => updateAboutArray("team", idx, { ...(member || EMPTY_TEAM), name: v })} />
                <Input label="Role" value={member?.role || ""} onChange={(v) => updateAboutArray("team", idx, { ...(member || EMPTY_TEAM), role: v })} />
                <Textarea label="Bio" value={member?.bio || ""} onChange={(v) => updateAboutArray("team", idx, { ...(member || EMPTY_TEAM), bio: v })} />
                <Input label="Photo URL" value={member?.img || ""} onChange={(v) => updateAboutArray("team", idx, { ...(member || EMPTY_TEAM), img: v })} />
                <Input label="Alt text" value={member?.alt || ""} onChange={(v) => updateAboutArray("team", idx, { ...(member || EMPTY_TEAM), alt: v })} />
                <FileInput
                  label="Upload photo"
                  onSelect={async (file) => {
                    const dataUrl = await readFileAsDataUrl(file);
                    updateAboutArray("team", idx, { ...(member || EMPTY_TEAM), img: dataUrl, alt: member?.alt || file.name });
                  }}
                />
                <button
                  onClick={() => removeAboutItem("team", idx)}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    border: "1px solid #e2e8f0",
                    background: "white",
                    color: "#ef4444",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            <button
              onClick={() => addAboutItem("team", { ...EMPTY_TEAM, name: "New member" })}
              style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}
            >
              + Add team member
            </button>
          </div>
        );
      }
      case "blogHero": {
        const hero = blogContent?.hero || {};
        return (
          <>
            <Input label="Title" value={hero.title || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), title: v } }))} />
            <Textarea label="Subtitle" value={hero.subtitle || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), subtitle: v } }))} />
            <Input label="CTA text" value={hero.ctaText || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), ctaText: v } }))} />
            <Input label="CTA URL" value={hero.ctaUrl || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), ctaUrl: v } }))} />
            <Input label="Alt text" value={hero.alt || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), alt: v } }))} />
            <Input label="Image URL" value={hero.image || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), image: v } }))} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                setBlogContent((prev) => ({
                  ...(prev || {}),
                  hero: { ...(hero || {}), image: dataUrl, alt: hero.alt || file.name },
                }));
              }}
            />
          </>
        );
      }
      case "blogPosts": {
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
            {(blogContent?.posts || []).map((post, idx) => (
              <div key={post?.id || idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input label="Title" value={post?.title || ""} onChange={(v) => updateBlogPost(idx, { ...post, title: v })} />
                <Textarea label="Excerpt" value={post?.excerpt || ""} onChange={(v) => updateBlogPost(idx, { ...post, excerpt: v })} />
                <Input label="Author" value={post?.author || ""} onChange={(v) => updateBlogPost(idx, { ...post, author: v })} />
                <Input label="Date" value={post?.date || ""} onChange={(v) => updateBlogPost(idx, { ...post, date: v })} />
                <Input label="Slug/URL" value={post?.slug || ""} onChange={(v) => updateBlogPost(idx, { ...post, slug: v })} />
                <Input label="Alt text" value={post?.alt || ""} onChange={(v) => updateBlogPost(idx, { ...post, alt: v })} />
                <Input label="Image URL" value={post?.image || ""} onChange={(v) => updateBlogPost(idx, { ...post, image: v })} />
                <Textarea
                  label="Tags (one per line)"
                  value={(post?.tags || []).join("\n")}
                  onChange={(v) => updateBlogPost(idx, { ...post, tags: v.split("\n").filter(Boolean) })}
                />
                <FileInput
                  label="Upload image"
                  onSelect={async (file) => {
                    const dataUrl = await readFileAsDataUrl(file);
                    updateBlogPost(idx, { ...post, image: dataUrl, alt: post?.alt || file.name });
                  }}
                />
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (loading || loadingBlog || loadingAbout) {
    return <div style={{ padding: 16 }}>Loading dashboard editor...</div>;
  }

  if (!content) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No content loaded."}</div>;
  }
  if (!blogContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No blog content loaded."}</div>;
  }
  if (!aboutContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No about content loaded."}</div>;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0b0f1a" }}>
      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Preview route:</span>
          {[
            { label: "Home", path: "/" },
            { label: "Blog", path: "/blog" },
            { label: "Shop", path: "/shop" },
            { label: "About", path: "/aboutus" },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => setPreviewPath(item.path)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #0a66ff",
                background: previewPath === item.path ? "#0a66ff" : "white",
                color: previewPath === item.path ? "white" : "#0a66ff",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
          <span style={{ color: "#64748b", fontSize: 12 }}>Home/Blog/About editable here; Shop is preview-only.</span>
        </div>
        {message && <span style={{ color: "#0a8", alignSelf: "center" }}>{message}</span>}
        {error && <span style={{ color: "#c00", alignSelf: "center" }}>{error}</span>}
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

      <div style={{ flex: 1, overflow: "auto" }}>
        {!showInlinePreview && <iframe title="Preview" src={previewPath} style={{ width: "100%", height: "60vh", border: 0, background: "white" }} />}
        {showInlinePreview && previewPath === "/" && (
          <>
            <Section
              initialContent={content}
              onEdit={{
                banner: () => openModal("banner"),
                hero1: () => openModal("hero1"),
                hero2: () => openModal("hero2"),
                training: () => openModal("training"),
                products: () => openModal("products"),
                actionShots: () => openModal("actionShots"),
                welcome: () => openModal("welcome"),
                reviews: () => openModal("reviews"),
                features: () => openModal("features"),
                menus: () => openModal("menus"),
              }}
            />
            <Box sx={{ my: 4 }}>
              <BlogSection
                initialContent={blogContent}
                onEdit={{
                  hero: () => openModal("blogHero"),
                  posts: () => openModal("blogPosts"),
                }}
              />
            </Box>
          </>
        )}
        {showInlinePreview && previewPath === "/blog" && (
          <Box sx={{ my: 4 }}>
            <BlogSection
              initialContent={blogContent}
              onEdit={{
                hero: () => openModal("blogHero"),
                posts: () => openModal("blogPosts"),
              }}
            />
          </Box>
        )}
        {showInlinePreview && previewPath === "/aboutus" && (
          <Box sx={{ my: 4 }}>
            <AboutSection
              initialContent={aboutContent}
              onEdit={{
                hero: () => openModal("aboutHero"),
                mission: () => openModal("aboutMission"),
                values: () => openModal("aboutValues"),
                approach: () => openModal("aboutApproach"),
                team: () => openModal("aboutTeam"),
                story: () => openModal("aboutStory"),
                contactCta: () => openModal("aboutContactCta"),
              }}
            />
          </Box>
        )}
        <Footer />
      </div>

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
          <div style={{ width: 800, maxWidth: "95%", maxHeight: "90vh", overflow: "auto", background: "white", borderRadius: 10, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, textTransform: "capitalize" }}>{activeSection}</h3>
              <button onClick={closeModal} style={{ border: "1px solid #ddd", borderRadius: 6, background: "white", padding: "6px 10px", cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{renderModalBody()}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={closeModal} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", background: "white" }} disabled={saving}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 12px", borderRadius: 6, border: "0", background: "#0a66ff", color: "white" }}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
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

function FileInput({ label, onSelect }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await onSelect(file);
          }
        }}
      />
    </label>
  );
}
