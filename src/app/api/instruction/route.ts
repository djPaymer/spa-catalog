import { NextRequest, NextResponse } from "next/server";
import { normalizeSiteUrl } from "@/lib/http";
import { fetchInstruction } from "@/lib/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = normalizeSiteUrl(body.url ?? "");
    const instruction = await fetchInstruction(url);
    return NextResponse.json(instruction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
