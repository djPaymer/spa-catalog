import { NextRequest, NextResponse } from "next/server";
import {
  createManufacturer,
  getCountriesById,
  listManufacturers,
  searchManufacturers,
  withCountries,
} from "@/lib/catalog";
import { parseCountryId, parsePagination, parseSearchName } from "@/lib/http";
import type { Country, Manufacturer, Paginated } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function paginateSearch(
  items: Manufacturer[],
  offset: number,
  limit: number,
): Paginated<Manufacturer> {
  const data = items.slice(offset, offset + limit);
  return {
    data,
    total: items.length,
    limit,
    offset,
    has_more: offset + data.length < items.length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { offset, limit } = parsePagination(request.nextUrl.searchParams);
    const name = parseSearchName(request.nextUrl.searchParams);
    const countryId = parseCountryId(request.nextUrl.searchParams);
    const [page, countries] = await Promise.all([
      name
        ? searchManufacturers(name).then((items) => {
            const filtered = countryId
              ? items.filter((item) => item.country_id === countryId)
              : items;
            return paginateSearch(filtered, offset, limit);
          })
        : listManufacturers(offset, limit, countryId),
      getCountriesById().catch(() => new Map<string, Country>()),
    ]);

    return NextResponse.json({
      data: withCountries(page.data ?? [], countries),
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      website?: string;
      country_id?: string;
      description?: string;
      address?: string;
    };
    const name = body.name?.trim() ?? "";
    const website = body.website?.trim() ?? "";
    const country_id = body.country_id?.trim() ?? "";
    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "Укажите название (до 200 символов)" },
        { status: 400 },
      );
    }
    if (!website || website.length > 100) {
      return NextResponse.json(
        { error: "Укажите сайт (до 100 символов)" },
        { status: 400 },
      );
    }
    if (!UUID.test(country_id)) {
      return NextResponse.json({ error: "Выберите страну" }, { status: 400 });
    }

    const [manufacturer, countries] = await Promise.all([
      createManufacturer({
        name,
        website,
        country_id,
        description: body.description?.trim() ?? "",
        address: body.address?.trim() ?? "",
      }),
      getCountriesById(),
    ]);
    return NextResponse.json(withCountries([manufacturer], countries)[0], {
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
