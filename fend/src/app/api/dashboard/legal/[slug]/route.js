"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../../auth";

const LEGAL_FILES = {
  "privacy-policy": "privacy-policy.json",
  "terms-conditions": "terms-conditions.json",
  "shipping-policy": "shipping-policy.json",
  "return-refund-policy": "return-refund-policy.json",
};

function getDataPath(slug) {
  const filename = LEGAL_FILES[slug];
  return filename ? path.join(process.cwd(), "data", filename) : null;
}

async function readContent(slug) {
  const dataPath = getDataPath(slug);
  if (!dataPath) return null;
  try {
    return JSON.parse(await fs.readFile(dataPath, "utf8"));
  } catch (err) {
    console.error(`${slug} content read error`, err);
    return null;
  }
}

export async function GET(_request, { params }) {
  const { slug } = await params;
  const content = await readContent(slug);
  if (!content) return NextResponse.json({ error: "Legal page not found" }, { status: 404 });
  return NextResponse.json(content);
}

export async function POST(request, { params }) {
  const authError = await requireDashboardAdmin("content.manage");
  if (authError) return authError;
  const { slug } = await params;
  const dataPath = getDataPath(slug);
  if (!dataPath) return NextResponse.json({ error: "Legal page not found" }, { status: 404 });

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || !body.content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }
    await fs.writeFile(dataPath, JSON.stringify(body.content, null, 2), "utf8");
    return NextResponse.json({ ok: true, content: body.content });
  } catch (err) {
    console.error(`${slug} content write error`, err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
