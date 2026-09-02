"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../auth";

const dataPath = path.join(process.cwd(), "data", "about.json");

const DEFAULT_CONTENT = {
  hero: {
    title: "About Us",
    subtitle: "We craft digital experiences that connect brands with people.",
    ctaText: "Contact Us",
    ctaUrl: "/contact",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    alt: "Team collaborating",
  },
  mission: "Empower businesses with simple, pragmatic technology. We focus on solving real problems with elegant solutions.",
  values: "Honesty, craftsmanship, and partnership guide everything we do.",
  team: [
    {
      name: "Nick Farahmand",
      role: "CEO & Founder",
      img: "/images/team-nick.jpg",
      bio: "Passionate about building teams and products that last.",
    },
    {
      name: "Parmis Nik Khah",
      role: "CTO",
      img: "/images/team-parmis.jpg",
      bio: "Systems thinker who loves turning messy problems into simple workflows.",
    },
  ],
  story: [
    "We started this project with a simple belief: online shopping should feel trustworthy, effortless, and human.",
    "Our approach is straightforward: start small, learn fast, and prioritize what matters to customers.",
    "As a small team, we value transparency and personal service. Your feedback matters.",
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
    console.error("about content read error", err);
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
    await writeContent(body.content);
    return NextResponse.json({ ok: true, content: body.content });
  } catch (err) {
    console.error("about content write error", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
