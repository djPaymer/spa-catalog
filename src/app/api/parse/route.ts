import { NextRequest, NextResponse } from "next/server";
import { normalizeSiteUrl } from "@/lib/http";
import { parseProducts } from "@/lib/parser";
import type { SiteInstruction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      url?: string;
      instruction?: SiteInstruction;
    };
    if (!body.instruction) {
      return NextResponse.json(
        { error: "Нужна инструкция парсинга" },
        { status: 400 },
      );
    }
    const url = normalizeSiteUrl(body.url ?? "");
    const result = await parseProducts(url, body.instruction);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
