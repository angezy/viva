import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { DEFAULT_SITE_CHROME } from "../../lib/siteChrome";
import { requireDashboardAdmin } from "../dashboard/auth";

const dataPath = path.join(process.cwd(), "data", "site-chrome.json");

async function ensureFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, JSON.stringify(DEFAULT_SITE_CHROME, null, 2), "utf8");
  }
}

export async function GET() {
  try {
    await ensureFile();
    const content = JSON.parse(await fs.readFile(dataPath, "utf8"));
    return NextResponse.json(content);
  } catch (error) {
    console.error("site chrome read error", error);
    return NextResponse.json(DEFAULT_SITE_CHROME);
  }
}

export async function POST(request) {
  const authError = await requireDashboardAdmin("content.manage");
  if (authError) return authError;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || !body.header || !body.footer) {
      return NextResponse.json({ error: "Missing site chrome content" }, { status: 400 });
    }
    await ensureFile();
    await fs.writeFile(dataPath, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true, content: body });
  } catch (error) {
    console.error("site chrome write error", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
