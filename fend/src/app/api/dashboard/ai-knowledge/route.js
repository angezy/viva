import { NextResponse } from "next/server";
import { requireDashboardAdmin } from "../auth";
import { readAIKnowledge, writeAIKnowledge } from "../../../lib/aiKnowledge";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await readAIKnowledge());
}

export async function PUT(request) {
  const authError = await requireDashboardAdmin("content.manage");
  if (authError) return authError;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Knowledge content is required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, knowledge: await writeAIKnowledge(body) });
  } catch (error) {
    console.error("AI knowledge save error", error);
    return NextResponse.json({ error: "Unable to save AI knowledge" }, { status: 500 });
  }
}
