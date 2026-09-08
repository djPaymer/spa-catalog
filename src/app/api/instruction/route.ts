import { NextRequest, NextResponse } from "next/server";
import { normalizeSiteUrl } from "@/lib/http";
import { fetchInstruction, jsonParserError } from "@/lib/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string; refresh?: boolean };
    const url = normalizeSiteUrl(body.url ?? "");
    const instruction = await fetchInstruction(url, Boolean(body.refresh));
    return NextResponse.json(instruction);
  } catch (error) {
    return jsonParserError(error);
  }
}
