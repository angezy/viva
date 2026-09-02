"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../auth";
import defaultContent from "../../../../../data/how-it-works.json";

const dataPath = path.join(process.cwd(), "data", "how-it-works.json");

async function ensureFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, JSON.stringify(defaultContent, null, 2), "utf8");
  }
}

async function readContent() {
  try {
    await ensureFile();
    return JSON.parse(await fs.readFile(dataPath, "utf8"));
  } catch (err) {
    console.error("how it works content read error", err);
    return defaultContent;
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
    console.error("how it works content write error", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
