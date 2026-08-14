import { NextResponse } from "next/server";
import { getChatConfig } from "../../../lib/chatConfig";

export async function GET() {
  return NextResponse.json(getChatConfig());
}
