"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../auth";
import { sanitizeBlogContent } from "../../../lib/contentSanitizer";

const dataPath = path.join(process.cwd(), "data", "blog.json");

const DEFAULT_CONTENT = {
  hero: {
    title: "Smart Wellness Starts Here.",
    subtitle: "Stories, tips, and training insights from coaches and athletes.",
    ctaText: "Read the latest",
    ctaUrl: "/blog",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    alt: "Athlete with smart trainer",
  },
  posts: [
    {
      id: "post-1",
      title: "Ergonomic Design That Powers Every Move",
      excerpt: "We broke down the biomechanics behind our latest release—here’s how it keeps you stable and strong.",
      author: "Coach Alex",
      date: "2024-12-01",
      image: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80",
      alt: "Closeup of training gear",
      tags: ["Gear", "Design"],
      slug: "/blog/ergonomic-design",
    },
    {
      id: "post-2",
      title: "Smarter Recovery: Mobility That Sticks",
      excerpt: "A 10-minute recovery flow that fits between sessions—and why consistency beats intensity.",
      author: "Dr. Lee",
      date: "2024-11-18",
      image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=800&q=80",
      alt: "Athlete stretching",
      tags: ["Recovery", "Mobility"],
      slug: "/blog/smarter-recovery",
    },
    {
      id: "post-3",
      title: "Coach-Built Plans for Busy Weeks",
      excerpt: "How to stack short sessions for real progress when your calendar is packed.",
      author: "Coach Nina",
      date: "2024-11-05",
      image: "https://images.unsplash.com/photo-1541537103745-ea3429c65dc1?auto=format&fit=crop&w=800&q=80",
      alt: "Training program notes",
      tags: ["Programming", "Coaching"],
      slug: "/blog/coach-built-plans",
    },
  ],
};

async function ensureFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, JSON.stringify(DEFAULT_CONTENT, null, 2), "utf8");
  }
}

async function readContent() {
  try {
    await ensureFile();
    const raw = await fs.readFile(dataPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("blog content read error", err);
    return DEFAULT_CONTENT;
  }
}

async function writeContent(content) {
  await fs.writeFile(dataPath, JSON.stringify(content, null, 2), "utf8");
}

export async function GET() {
  const content = await readContent();
  return NextResponse.json(content);
}

export async function POST(req) {
  const authError = await requireDashboardAdmin("content.manage");
  if (authError) return authError;
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || !body.content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }
    await ensureFile();
    const content = sanitizeBlogContent(body.content);
    await writeContent(content);
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    console.error("blog content write error", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
