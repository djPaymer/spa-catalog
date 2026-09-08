import { NextResponse } from "next/server";
import { listCountries } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const data = await listCountries();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
