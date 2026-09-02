"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../auth";

const dataPath = path.join(process.cwd(), "data", "shop.json");

const DEFAULT_CONTENT = {
  hero: {
    title: "Shop the Collection",
    description: "Discover curated essentials, trending drops, and limited releases tailored to your lifestyle.",
    backgroundImage:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80",
    backgroundPosition: "center",
  },
  searchPlaceholder: "Search products",
  ctaText: "Start Shopping",
  catalogTitle: "Browse products",
  emptyMessage: "No products match your search.",
  categoryLimit: 6,
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
    console.error("shop content read error", err);
    return DEFAULT_CONTENT;
  }
}

export async function GET() {
  return NextResponse.json(await readContent());
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
    await fs.writeFile(dataPath, JSON.stringify(body.content, null, 2), "utf8");
    return NextResponse.json({ ok: true, content: body.content });
  } catch (err) {
    console.error("shop content write error", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
