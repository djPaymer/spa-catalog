import { NextRequest, NextResponse } from "next/server";
import {
  createProduct,
  listManufacturerProducts,
  saveProductsToCatalog,
} from "@/lib/catalog";
import { parsePagination } from "@/lib/http";
import type { ParsedProduct } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const manufacturerId =
      request.nextUrl.searchParams.get("manufacturer_id")?.trim() ?? "";
    if (!UUID.test(manufacturerId)) {
      return NextResponse.json(
        { error: "Нужен manufacturer_id" },
        { status: 400 },
      );
    }
    const { offset, limit } = parsePagination(request.nextUrl.searchParams);
    const page = await listManufacturerProducts(
      manufacturerId,
      offset,
      limit,
    );
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manufacturer_id?: string;
      category_id?: string;
      product_type_id?: string;
      name?: string;
      url?: string;
      description?: string;
      products?: ParsedProduct[];
    };

    if (!UUID.test(body.manufacturer_id ?? "")) {
      return NextResponse.json(
        { error: "Нужен manufacturer_id" },
        { status: 400 },
      );
    }
    if (!UUID.test(body.category_id ?? "")) {
      return NextResponse.json({ error: "Выберите категорию" }, { status: 400 });
    }
    if (!UUID.test(body.product_type_id ?? "")) {
      return NextResponse.json(
        { error: "Выберите тип товара" },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.products)) {
      const name = body.name?.trim() ?? "";
      const url = body.url?.trim() ?? "";
      if (!name || name.length > 200) {
        return NextResponse.json(
          { error: "Укажите название (до 200 символов)" },
          { status: 400 },
        );
      }
      if (!url || url.length > 500) {
        return NextResponse.json(
          { error: "Укажите URL (до 500 символов)" },
          { status: 400 },
        );
      }
      const product = await createProduct({
        manufacturer_id: body.manufacturer_id!,
        category_id: body.category_id!,
        product_type_id: body.product_type_id!,
        name,
        url,
        description: body.description?.trim() ?? "",
      });
      return NextResponse.json(product);
    }

    if (body.products.length === 0) {
      return NextResponse.json({ error: "Нет товаров для записи" }, { status: 400 });
    }

    const result = await saveProductsToCatalog({
      manufacturer_id: body.manufacturer_id!,
      category_id: body.category_id!,
      product_type_id: body.product_type_id!,
      products: body.products,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
