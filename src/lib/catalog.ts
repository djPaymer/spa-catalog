import { getCatalogBaseUrl } from "@/lib/env";
import { readError, upstreamFetch } from "@/lib/http";
import type {
  Category,
  CatalogProduct,
  Country,
  Manufacturer,
  ManufacturerRow,
  Paginated,
  ParsedProduct,
  ProductType,
  SaveProductsResult,
} from "@/lib/types";

const PAGE = 100;
const COUNTRY_TTL_MS = 5 * 60 * 1000;
const TAXONOMY_TTL_MS = 5 * 60 * 1000;
const CREATE_CONCURRENCY = 4;
const CATALOG_ATTEMPTS = 4;
const RETRY_STATUSES = new Set([404, 502, 503]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let countriesCache: { at: number; byId: Map<string, Country> } | null = null;
let countriesInflight: Promise<Map<string, Country>> | null = null;
let categoriesCache: { at: number; items: Category[] } | null = null;
let productTypesCache: { at: number; items: ProductType[] } | null = null;

async function catalogRequest<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const url = `${getCatalogBaseUrl()}${path}`;
  const headers = {
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...init.headers,
  };
  let lastError: Error & { status?: number } = new Error(
    `td-catalog ${path}: неизвестная ошибка`,
  );

  for (let attempt = 0; attempt < CATALOG_ATTEMPTS; attempt += 1) {
    try {
      const res = await upstreamFetch(url, { ...init, headers });
      if (res.status === 204) {
        return undefined as T;
      }
      if (!res.ok) {
        lastError = Object.assign(
          new Error(`td-catalog ${path}: ${await readError(res)}`),
          { status: res.status },
        );
        if (RETRY_STATUSES.has(res.status) && attempt < CATALOG_ATTEMPTS - 1) {
          await sleep(80 * (attempt + 1));
          continue;
        }
        throw lastError;
      }
      if (
        res.status === 201 ||
        res.headers.get("content-type")?.includes("json")
      ) {
        return res.json() as Promise<T>;
      }
      return res.json() as Promise<T>;
    } catch (error) {
      if (error === lastError) throw error;
      lastError =
        error instanceof Error
          ? error
          : new Error(`td-catalog ${path}: ${String(error)}`);
      if (attempt < CATALOG_ATTEMPTS - 1) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

async function catalogGet<T>(path: string, timeoutMs = 30_000) {
  return catalogRequest<T>(path, { timeoutMs });
}

function pageItems<T>(page: unknown): T[] {
  if (Array.isArray(page)) return page as T[];
  if (page && typeof page === "object") {
    const record = page as { data?: T[]; items?: T[] };
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

async function listAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await catalogGet<Paginated<T> | T[]>(
      `${path}${sep}offset=${offset}&limit=${PAGE}`,
      60_000,
    );
    if (Array.isArray(page)) return page;
    const chunk = pageItems<T>(page);
    if (Number.isFinite(page.total)) total = page.total;
    items.push(...chunk);
    if (!chunk.length || !page.has_more) break;
    offset += chunk.length;
  }
  return items;
}

export async function listManufacturers(
  offset: number,
  limit: number,
  countryId?: string,
) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (countryId) params.set("country_id", countryId);
  return catalogGet<Paginated<Manufacturer>>(
    `/api/v1/manufacturer?${params.toString()}`,
  );
}

export async function searchManufacturers(name: string) {
  const params = new URLSearchParams({ name });
  return catalogGet<Manufacturer[]>(
    `/api/v1/manufacturer/search?${params.toString()}`,
  );
}

export async function getCountriesById(): Promise<Map<string, Country>> {
  const now = Date.now();
  if (
    countriesCache &&
    countriesCache.byId.size > 0 &&
    now - countriesCache.at < COUNTRY_TTL_MS
  ) {
    return countriesCache.byId;
  }
  if (countriesInflight) return countriesInflight;

  countriesInflight = (async () => {
    const byId = new Map<string, Country>();
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        byId.clear();
        for (const country of await listAll<Country>("/api/v1/country")) {
          byId.set(country.id, country);
        }
        if (byId.size > 0) break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) continue;
        throw error;
      }
    }
    if (byId.size === 0 && lastError) throw lastError;
    if (byId.size > 0) {
      countriesCache = { at: Date.now(), byId };
    }
    return byId;
  })().finally(() => {
    countriesInflight = null;
  });

  return countriesInflight;
}

export async function listCountries(): Promise<Country[]> {
  const byId = await getCountriesById();
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function withCountry(
  manufacturer: Manufacturer,
  countries: Map<string, Country>,
): ManufacturerRow {
  const country = countries.get(manufacturer.country_id);
  return {
    ...manufacturer,
    country_name: country?.name ?? "—",
    country_code: country?.code ?? null,
  };
}

export function withCountries(
  manufacturers: Manufacturer[],
  countries: Map<string, Country>,
): ManufacturerRow[] {
  return manufacturers.map((manufacturer) =>
    withCountry(manufacturer, countries),
  );
}

export async function getManufacturer(id: string) {
  return catalogGet<Manufacturer>(`/api/v1/manufacturer/${id}`);
}

export async function updateManufacturer(
  id: string,
  body: {
    name: string;
    website: string;
    country_id: string;
    description?: string;
    address?: string;
  },
) {
  return catalogRequest<Manufacturer>(`/api/v1/manufacturer/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: body.name,
      website: body.website,
      country_id: body.country_id,
      description: body.description ?? "",
      address: body.address ?? "",
    }),
  });
}

export async function createManufacturer(body: {
  name: string;
  website: string;
  country_id: string;
  description?: string;
  address?: string;
}) {
  return catalogRequest<Manufacturer>("/api/v1/manufacturer", {
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      website: body.website,
      country_id: body.country_id,
      description: body.description ?? "",
      address: body.address ?? "",
    }),
  });
}

export async function deleteManufacturer(id: string) {
  return catalogRequest<void>(`/api/v1/manufacturer/${id}`, {
    method: "DELETE",
    timeoutMs: 30_000,
  });
}

export async function listCategories(): Promise<Category[]> {
  const now = Date.now();
  if (categoriesCache && now - categoriesCache.at < TAXONOMY_TTL_MS) {
    return categoriesCache.items;
  }
  const items = await listAll<Category>("/api/v1/category");
  items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  categoriesCache = { at: now, items };
  return items;
}

export async function listProductTypes(): Promise<ProductType[]> {
  const now = Date.now();
  if (productTypesCache && now - productTypesCache.at < TAXONOMY_TTL_MS) {
    return productTypesCache.items;
  }
  const items = await listAll<ProductType>("/api/v1/product_type");
  items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  productTypesCache = { at: now, items };
  return items;
}

export async function createProduct(body: {
  name: string;
  description?: string;
  url: string;
  manufacturer_id: string;
  category_id: string;
  product_type_id: string;
}) {
  const created = await catalogRequest<CatalogProduct>("/api/v1/product", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 30_000,
  });
  invalidateManufacturerProducts(body.manufacturer_id);
  return created;
}

export async function updateProduct(
  id: string,
  body: {
    name: string;
    description: string;
    url: string;
    category_id: string;
    product_type_id: string;
  },
) {
  const updated = await catalogRequest<CatalogProduct>(
    `/api/v1/product/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      timeoutMs: 30_000,
    },
  );
  invalidateManufacturerProducts(updated.manufacturer_id);
  return updated;
}

export async function deleteProduct(id: string, manufacturerId?: string) {
  await catalogRequest<void>(`/api/v1/product/${id}`, {
    method: "DELETE",
    timeoutMs: 30_000,
  });
  invalidateManufacturerProducts(manufacturerId);
}

const PRODUCT_LIST_TTL_MS = 60 * 1000;
const manufacturerProductsCache = new Map<
  string,
  { at: number; items: CatalogProduct[] }
>();

function invalidateManufacturerProducts(manufacturerId?: string) {
  if (manufacturerId) {
    manufacturerProductsCache.delete(manufacturerId);
    return;
  }
  manufacturerProductsCache.clear();
}

export async function listManufacturerProducts(
  manufacturerId: string,
  offset: number,
  limit: number,
): Promise<Paginated<CatalogProduct>> {
  const now = Date.now();
  const cached = manufacturerProductsCache.get(manufacturerId);
  let items = cached && now - cached.at < PRODUCT_LIST_TTL_MS ? cached.items : null;
  if (!items) {
    const all = await listAll<CatalogProduct>(
      `/api/v1/product?manufacturer_id=${manufacturerId}`,
    );
    items = all.filter((item) => item.manufacturer_id === manufacturerId);
    manufacturerProductsCache.set(manufacturerId, { at: now, items });
  }
  const data = items.slice(offset, offset + limit);
  return {
    data,
    total: items.length,
    limit,
    offset,
    has_more: offset + data.length < items.length,
  };
}

export async function markManufacturerParsed(manufacturerId: string) {
  return catalogRequest(`/api/v1/manufacturer/${manufacturerId}/mark-parsed`, {
    method: "PATCH",
    timeoutMs: 30_000,
  });
}

export async function saveProductsToCatalog(input: {
  manufacturer_id: string;
  category_id: string;
  product_type_id: string;
  products: ParsedProduct[];
}): Promise<SaveProductsResult> {
  const result: SaveProductsResult = {
    created: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const seen = new Set<string>();
  const jobs: ParsedProduct[] = [];
  for (const product of input.products) {
    const url = product.url.trim().slice(0, 500);
    if (!url || seen.has(url)) {
      result.skipped += 1;
      continue;
    }
    seen.add(url);
    jobs.push({
      url,
      name: (product.name || "Без названия").trim().slice(0, 200) || "Без названия",
    });
  }

  await mapPool(jobs, CREATE_CONCURRENCY, async (product) => {
    try {
      await createProduct({
        name: product.name,
        description: "",
        url: product.url,
        manufacturer_id: input.manufacturer_id,
        category_id: input.category_id,
        product_type_id: input.product_type_id,
      });
      result.created += 1;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) {
        result.errors.push({
          url: product.url,
          error: error instanceof Error ? error.message : "Ошибка записи",
        });
      }
    }
  });

  if (result.created > 0) {
    try {
      await markManufacturerParsed(input.manufacturer_id);
    } catch {
      /* product save succeeded even if mark-parsed failed */
    }
  }

  return result;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
}
