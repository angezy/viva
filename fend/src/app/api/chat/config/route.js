import { NextResponse } from "next/server";
import { getChatConfig } from "../../../lib/chatConfig";
import { readAIKnowledge } from "../../../lib/aiKnowledge";

export async function GET() {
  const config = getChatConfig();
  const knowledge = await readAIKnowledge();
  return NextResponse.json({ ...config, greeting: knowledge.greeting || config.greeting });
}
