import { getCatalogBaseUrl } from "@/lib/env";
import { readError, upstreamFetch } from "@/lib/http";
import type { Country, Manufacturer, Paginated } from "@/lib/types";

const COUNTRY_PAGE = 200;
const COUNTRY_TTL_MS = 5 * 60 * 1000;

let countriesCache: { at: number; byId: Map<string, Country> } | null = null;

async function catalogGet<T>(path: string): Promise<T> {
  const url = `${getCatalogBaseUrl()}${path}`;
  const res = await upstreamFetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`td-catalog ${path}: ${await readError(res)}`);
  }
  return res.json() as Promise<T>;
}

export async function listManufacturers(offset: number, limit: number) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return catalogGet<Paginated<Manufacturer>>(
    `/api/v1/manufacturer?${params.toString()}`,
  );
}

export async function getCountriesById(): Promise<Map<string, Country>> {
  const now = Date.now();
  if (countriesCache && now - countriesCache.at < COUNTRY_TTL_MS) {
    return countriesCache.byId;
  }

  const byId = new Map<string, Country>();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await catalogGet<Paginated<Country>>(
      `/api/v1/country?offset=${offset}&limit=${COUNTRY_PAGE}`,
    );
    total = page.total;
    for (const country of page.data) {
      byId.set(country.id, country);
    }
    if (!page.data.length || !page.has_more) {
      break;
    }
    offset += page.data.length;
  }

  countriesCache = { at: now, byId };
  return byId;
}
