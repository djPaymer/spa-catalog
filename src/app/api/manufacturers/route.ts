import { NextRequest, NextResponse } from "next/server";
import { getCountriesById, listManufacturers } from "@/lib/catalog";
import { parsePagination } from "@/lib/http";
import type { ManufacturerRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { offset, limit } = parsePagination(request.nextUrl.searchParams);
    const [page, countries] = await Promise.all([
      listManufacturers(offset, limit),
      getCountriesById(),
    ]);

    const data: ManufacturerRow[] = page.data.map((manufacturer) => {
      const country = countries.get(manufacturer.country_id);
      return {
        ...manufacturer,
        country_name: country?.name ?? "—",
        country_code: country?.code ?? null,
      };
    });

    return NextResponse.json({
      data,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      has_more: page.has_more,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
