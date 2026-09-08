import { NextRequest, NextResponse } from "next/server";
import { deleteProduct, updateProduct } from "@/lib/catalog";

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
      description?: string;
      url?: string;
      category_id?: string;
      product_type_id?: string;
    };
    const name = body.name?.trim() ?? "";
    const url = body.url?.trim() ?? "";
    const category_id = body.category_id?.trim() ?? "";
    const product_type_id = body.product_type_id?.trim() ?? "";
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
    if (!UUID.test(category_id)) {
      return NextResponse.json({ error: "Выберите категорию" }, { status: 400 });
    }
    if (!UUID.test(product_type_id)) {
      return NextResponse.json(
        { error: "Выберите тип товара" },
        { status: 400 },
      );
    }
    const product = await updateProduct(id, {
      name,
      url,
      description: body.description?.trim() ?? "",
      category_id,
      product_type_id,
    });
    return NextResponse.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusOf(error) });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
    }
    const manufacturerId =
      request.nextUrl.searchParams.get("manufacturer_id")?.trim() ?? "";
    await deleteProduct(id, UUID.test(manufacturerId) ? manufacturerId : undefined);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusOf(error) });
  }
}
