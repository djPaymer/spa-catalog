import { NextRequest, NextResponse } from "next/server";
import { normalizeSiteUrl } from "@/lib/http";
import {
  deleteInstruction,
  getStoredInstruction,
  jsonParserError,
  saveInstruction,
} from "@/lib/parser";
import type { SiteInstruction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ host: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { host } = await context.params;
    const record = await getStoredInstruction(decodeURIComponent(host));
    return NextResponse.json(record);
  } catch (error) {
    return jsonParserError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { host } = await context.params;
    const body = (await request.json()) as {
      url?: string;
      instruction?: SiteInstruction;
    };
    if (!body.instruction) {
      return NextResponse.json(
        { error: "Передайте instruction" },
        { status: 400 },
      );
    }
    const url = body.url ? normalizeSiteUrl(body.url) : undefined;
    const record = await saveInstruction(
      decodeURIComponent(host),
      body.instruction,
      url,
    );
    return NextResponse.json(record);
  } catch (error) {
    return jsonParserError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { host } = await context.params;
    await deleteInstruction(decodeURIComponent(host));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonParserError(error);
  }
}
