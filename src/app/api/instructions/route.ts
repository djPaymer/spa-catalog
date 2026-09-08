import { NextResponse } from "next/server";
import { jsonParserError, listInstructions } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listInstructions();
    return NextResponse.json(data);
  } catch (error) {
    return jsonParserError(error);
  }
}
