import { NextRequest, NextResponse } from "next/server";
import {
  deleteManufacturer,
  getCountriesById,
  getManufacturer,
  updateManufacturer,
  withCountry,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

function statusOf(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status === 404 ? 404 : 502;
  }
  return 502;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
    }
    const [manufacturer, countries] = await Promise.all([
      getManufacturer(id),
      getCountriesById().catch(() => new Map()),
    ]);
    return NextResponse.json(withCountry(manufacturer, countries));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusOf(error) });
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
    }
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
      updateManufacturer(id, {
        name,
        website,
        country_id,
        description: body.description?.trim() ?? "",
        address: body.address?.trim() ?? "",
      }),
      getCountriesById().catch(() => new Map()),
    ]);
    return NextResponse.json(withCountry(manufacturer, countries));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusOf(error) });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
    }
    await deleteManufacturer(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusOf(error) });
  }
}
