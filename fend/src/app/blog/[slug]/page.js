"use server";

import { notFound } from "next/navigation";
import path from "path";
import { promises as fs } from "fs";

async function readBlog() {
  const dataPath = path.join(process.cwd(), "data", "blog.json");
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function BlogDetail({ params }) {
  const { slug } = await params;
  const data = await readBlog();
  const posts = data?.posts || [];
  const match = posts.find((p) => {
    const normalized = (p.slug || "").replace(/^\/blog\//, "").replace(/^\//, "");
    return normalized === slug;
  });

  if (!match) return notFound();

  const safeBody = match.body || "<p>No content yet.</p>";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 48px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div style={{ color: "#64748b", fontSize: 12 }}>{match.date} · {match.author}</div>
        <h1 style={{ margin: 0, fontSize: 32 }}>{match.title}</h1>
        <div style={{ color: "#0f172a", fontSize: 16 }}>{match.excerpt}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(match.tags || []).map((t) => (
            <span key={t} style={{ background: "#e0e7ff", color: "#1d4ed8", padding: "4px 8px", borderRadius: 12, fontSize: 12 }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {match.image && (
        <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <img src={match.image} alt={match.alt || match.title} style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
      )}

      <div
        style={{ color: "#1f2937", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: safeBody }}
      />
    </div>
  );
}
